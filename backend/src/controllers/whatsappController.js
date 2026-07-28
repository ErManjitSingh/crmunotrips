const Lead = require('../models/Lead');
const WhatsAppMessage = require('../models/WhatsAppMessage');
const WhatsAppNote = require('../models/WhatsAppNote');
const WhatsAppConversation = require('../models/WhatsAppConversation');
const FollowUp = require('../models/FollowUp');
const User = require('../models/User');
const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');
const {
  LEAD_LIST_POPULATE,
  enrichLead,
  FOLLOWUP_POPULATE,
} = require('../utils/queryHelpers');
const { parsePagination, paginatedResponse } = require('../utils/pagination');
const {
  sendWhatsAppText,
  createLeadFromConversation,
  isConfigured,
  normalizePhone,
} = require('../services/whatsappCloudService');

function isSalesExecutive(req) {
  return req.user?.role === 'sales_executive';
}

function leadScopeFilter(req, extra = {}) {
  const filter = { ...extra, isDeleted: { $ne: true } };
  if (req.branchId) filter.branchId = req.branchId;
  if (isSalesExecutive(req)) filter.assignedTo = req.user._id;
  return filter;
}

async function findScopedLead(req, leadId, select = '_id') {
  const lead = await Lead.findOne(leadScopeFilter(req, { _id: leadId })).select(select);
  if (!lead) throw new ApiError(404, 'Lead not found');
  return lead;
}

async function assertConversationAccess(req, conversation) {
  if (!conversation) throw new ApiError(404, 'Conversation not found');
  if (!isSalesExecutive(req)) return conversation;
  if (!conversation.lead) throw new ApiError(403, 'This chat is not assigned to you');
  await findScopedLead(req, conversation.lead, '_id');
  return conversation;
}

const listConversations = asyncHandler(async (req, res) => {
  const { status, search, onlyUnlinked } = req.query;
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 40, maxLimit: 100 });
  const executiveOnly = isSalesExecutive(req);

  // Executives only see chats linked to leads assigned to them
  if (executiveOnly && (onlyUnlinked === '1' || onlyUnlinked === 'true')) {
    return res.json(paginatedResponse([], { page, limit, total: 0 }));
  }

  const filter = { isArchived: { $ne: true } };
  if (req.branchId) {
    filter.$and = [
      {
        $or: [
          { branchId: req.branchId },
          { branchId: null },
          { branchId: { $exists: false } },
        ],
      },
    ];
  }

  if (executiveOnly) {
    const myLeadIds = await Lead.find(leadScopeFilter(req)).distinct('_id');
    filter.lead = { $in: myLeadIds };
  } else if (onlyUnlinked === '1' || onlyUnlinked === 'true') {
    filter.lead = null;
  }

  if (search) {
    const q = String(search).trim();
    const searchOr = [
      { phone: new RegExp(q.replace(/\D/g, '').slice(-10) || q, 'i') },
      { profileName: new RegExp(q, 'i') },
      { lastMessageText: new RegExp(q, 'i') },
    ];
    if (filter.$and) filter.$and.push({ $or: searchOr });
    else filter.$or = searchOr;
  }

  const [conversations, total] = await Promise.all([
    WhatsAppConversation.find(filter)
      .populate({
        path: 'lead',
        select: '-notes',
        populate: LEAD_LIST_POPULATE,
      })
      .sort({ lastMessageAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    WhatsAppConversation.countDocuments(filter),
  ]);

  let rows = conversations.map((c) => {
    const lead = c.lead ? enrichLead(c.lead) : null;
    if (status && lead && lead.status !== status) return null;
    if (status && !lead) return null;
    if (executiveOnly && !lead) return null;
    return {
      _id: c._id,
      conversationId: c._id,
      phone: c.phone,
      waId: c.waId || (c.phone ? `91${c.phone}` : ''),
      profileName: c.profileName || '',
      leadId: lead?._id || null,
      lead,
      hasLead: Boolean(lead),
      lastMessage: c.lastMessageText
        ? {
            text: c.lastMessageText,
            direction: c.lastDirection,
            timestamp: c.lastMessageAt,
          }
        : null,
      unreadCount: c.unreadCount || 0,
      updatedAt: c.lastMessageAt || c.updatedAt,
    };
  }).filter(Boolean);

  // Fallback: classic channel=whatsapp leads with no conversation (not for unlinked-only)
  if (!onlyUnlinked && page === 1) {
    const leadFilter = leadScopeFilter(req, { channel: 'whatsapp' });
    if (status) leadFilter.status = status;
    const linkedPhones = new Set(rows.filter((r) => r.leadId).map((r) => normalizePhone(r.phone)));
    const orphanLeads = await Lead.find(leadFilter)
      .select('-notes')
      .populate(LEAD_LIST_POPULATE)
      .sort({ updatedAt: -1 })
      .limit(25)
      .lean();

    for (const leadRaw of orphanLeads) {
      const phone = normalizePhone(leadRaw.phone || leadRaw.whatsapp);
      if (!phone || linkedPhones.has(phone)) continue;
      const lead = enrichLead(leadRaw);
      rows.push({
        _id: `lead-${lead._id}`,
        conversationId: null,
        phone,
        waId: phone ? `91${phone}` : '',
        profileName: lead.name || '',
        leadId: lead._id,
        lead,
        hasLead: true,
        lastMessage: null,
        unreadCount: 0,
        updatedAt: lead.updatedAt,
      });
    }
  }

  rows.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));

  res.json(paginatedResponse(rows.slice(0, limit), { page, limit, total: Math.max(total, rows.length) }));
});

const getMessagesByConversation = asyncHandler(async (req, res) => {
  const conversation = await WhatsAppConversation.findById(req.params.conversationId).select('_id lead');
  await assertConversationAccess(req, conversation);

  const messages = await WhatsAppMessage.find({ conversation: conversation._id })
    .sort({ timestamp: 1 })
    .lean();
  res.json(messages);
});

const getMessages = asyncHandler(async (req, res) => {
  const lead = await findScopedLead(req, req.params.leadId, '_id phone whatsapp');

  const phone = normalizePhone(lead.phone || lead.whatsapp);
  const conversation = phone
    ? await WhatsAppConversation.findOne({ phone }).select('_id')
    : null;

  const filter = conversation
    ? { $or: [{ lead: lead._id }, { conversation: conversation._id }] }
    : { lead: lead._id };

  const messages = await WhatsAppMessage.find(filter).sort({ timestamp: 1 }).lean();
  res.json(messages);
});

const getNotes = asyncHandler(async (req, res) => {
  const lead = await findScopedLead(req, req.params.leadId, '_id');

  const notes = await WhatsAppNote.find({ lead: lead._id })
    .populate('user', 'name email')
    .sort({ createdAt: -1 })
    .lean();
  res.json(notes);
});

const getFollowUpsForLead = asyncHandler(async (req, res) => {
  const lead = await findScopedLead(req, req.params.leadId, '_id');

  const followups = await FollowUp.find({
    lead: lead._id,
    ...(req.branchId ? { branchId: req.branchId } : {}),
  })
    .populate(FOLLOWUP_POPULATE)
    .sort({ scheduledAt: -1 })
    .lean();
  res.json(followups);
});

const listExecutives = asyncHandler(async (req, res) => {
  if (isSalesExecutive(req)) {
    throw new ApiError(403, 'Not allowed');
  }
  const executives = await User.find({
    role: 'sales_executive',
    status: 'active',
    ...(req.branchId ? { branchId: req.branchId } : {}),
  })
    .select('name email')
    .lean();
  res.json(executives);
});

const postMessage = asyncHandler(async (req, res) => {
  const { leadId, conversationId, text, type = 'text', attachment } = req.body;
  if (!text?.trim() && !attachment) throw new ApiError(400, 'Message text is required');

  let conversation = null;
  let lead = null;

  if (conversationId) {
    conversation = await WhatsAppConversation.findById(conversationId);
    await assertConversationAccess(req, conversation);
    if (conversation.lead) {
      lead = await findScopedLead(req, conversation.lead, '_id name phone whatsapp branchId');
    }
  } else if (leadId) {
    lead = await findScopedLead(req, leadId, '_id name phone whatsapp branchId');
    const phone = normalizePhone(lead.phone || lead.whatsapp);
    conversation = phone ? await WhatsAppConversation.findOne({ phone }) : null;
    if (!conversation && phone) {
      conversation = await WhatsAppConversation.create({
        phone,
        profileName: lead.name || '',
        lead: lead._id,
        branchId: lead.branchId || req.branchId || undefined,
        lastMessageText: text || '',
        lastMessageAt: new Date(),
        lastDirection: 'outgoing',
      });
    }
  } else {
    throw new ApiError(400, 'conversationId or leadId is required');
  }

  const toPhone = conversation?.phone || lead?.phone || lead?.whatsapp;
  let waMessageId = null;
  let status = 'sent';

  if (isConfigured() && toPhone && text?.trim()) {
    try {
      const sent = await sendWhatsAppText({ toPhone, text: text.trim() });
      waMessageId = sent?.messages?.[0]?.id || null;
    } catch (err) {
      status = 'failed';
      throw err;
    }
  }

  const msg = await WhatsAppMessage.create({
    conversation: conversation?._id,
    lead: lead?._id || conversation?.lead || undefined,
    waMessageId,
    fromPhone: toPhone || '',
    direction: 'outgoing',
    type,
    text: text || '',
    attachment: attachment || null,
    status,
    timestamp: new Date(),
    sentBy: req.user._id,
  });

  if (conversation) {
    conversation.lastMessageText = text || conversation.lastMessageText;
    conversation.lastMessageAt = new Date();
    conversation.lastDirection = 'outgoing';
    await conversation.save();
  }

  res.status(201).json(msg);
});

const postNote = asyncHandler(async (req, res) => {
  const { leadId, text } = req.body;
  if (!leadId || !text?.trim()) throw new ApiError(400, 'leadId and text are required');

  await findScopedLead(req, leadId, '_id');

  const note = await WhatsAppNote.create({
    lead: leadId,
    text: text.trim(),
    user: req.user._id,
  });

  const populated = await WhatsAppNote.findById(note._id).populate('user', 'name email').lean();
  res.status(201).json(populated);
});

const updateWhatsAppLead = asyncHandler(async (req, res) => {
  const body = { ...req.body };
  // Executives cannot reassign leads from WhatsApp inbox
  if (isSalesExecutive(req)) {
    delete body.assignedTo;
  }

  const lead = await Lead.findOneAndUpdate(
    leadScopeFilter(req, { _id: req.params.id }),
    body,
    { new: true, runValidators: true }
  )
    .populate(LEAD_LIST_POPULATE)
    .lean();
  if (!lead) throw new ApiError(404, 'Lead not found');
  res.json(enrichLead(lead));
});

const markRead = asyncHandler(async (req, res) => {
  const { leadId } = req.params;
  const conversationId = req.query.conversationId || req.body?.conversationId;

  if (conversationId) {
    const conversation = await WhatsAppConversation.findById(conversationId).select('_id lead');
    await assertConversationAccess(req, conversation);
    await WhatsAppConversation.findByIdAndUpdate(conversationId, { unreadCount: 0 });
    await WhatsAppMessage.updateMany(
      { conversation: conversationId, direction: 'incoming' },
      { status: 'read' }
    );
  }

  if (leadId && leadId !== 'none') {
    const lead = await findScopedLead(req, leadId, '_id');
    await WhatsAppMessage.updateMany(
      { lead: lead._id, direction: 'incoming' },
      { status: 'read' }
    );
  }

  res.json({ success: true });
});

const createLeadFromChat = asyncHandler(async (req, res) => {
  if (isSalesExecutive(req)) {
    throw new ApiError(403, 'Only managers/admins can create leads from WhatsApp chats');
  }
  const { conversationId, name, destination, email, city, message } = req.body || {};
  if (!conversationId) throw new ApiError(400, 'conversationId is required');

  const result = await createLeadFromConversation(
    conversationId,
    { name, destination, email, city, message },
    req.user
  );

  res.status(result.duplicate ? 200 : 201).json({
    success: true,
    duplicate: result.duplicate,
    message: result.duplicate ? 'Lead already linked' : 'Lead created from WhatsApp chat',
    data: {
      id: result.lead?._id,
      leadId: result.lead?.leadId,
      name: result.lead?.name,
      phone: result.lead?.phone,
      destination: result.lead?.destination,
      source: result.lead?.source,
      sourceLabel: result.lead?.sourceLabel,
      status: result.lead?.status,
    },
  });
});

const cloudStatus = asyncHandler(async (_req, res) => {
  res.json({
    configured: isConfigured(),
    inboxMode: isConfigured() ? 'cloud_api' : 'local_only',
  });
});

module.exports = {
  listConversations,
  getMessages,
  getMessagesByConversation,
  getNotes,
  getFollowUpsForLead,
  listExecutives,
  postMessage,
  postNote,
  updateWhatsAppLead,
  markRead,
  createLeadFromChat,
  cloudStatus,
};
