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

const listConversations = asyncHandler(async (req, res) => {
  const { status, search, onlyUnlinked } = req.query;
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 40, maxLimit: 100 });

  const filter = { isArchived: { $ne: true } };
  // Include conversations not yet tagged with a branch (webhook ingest used to omit branchId)
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
  if (onlyUnlinked === '1' || onlyUnlinked === 'true') filter.lead = null;
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
    return {
      _id: c._id,
      conversationId: c._id,
      phone: c.phone,
      profileName: c.profileName || lead?.name || `+91 ${c.phone}`,
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

  // Fallback: also include classic channel=whatsapp leads with no conversation row yet
  if (!onlyUnlinked && page === 1) {
    const leadFilter = { channel: 'whatsapp', isDeleted: { $ne: true } };
    if (req.branchId) leadFilter.branchId = req.branchId;
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
        profileName: lead.name,
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
  if (!conversation) throw new ApiError(404, 'Conversation not found');

  const messages = await WhatsAppMessage.find({ conversation: conversation._id })
    .sort({ timestamp: 1 })
    .lean();
  res.json(messages);
});

const getMessages = asyncHandler(async (req, res) => {
  const lead = await Lead.findOne({
    _id: req.params.leadId,
    ...(req.branchId ? { branchId: req.branchId } : {}),
  }).select('_id phone whatsapp');
  if (!lead) throw new ApiError(404, 'Lead not found');

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
  const lead = await Lead.findOne({
    _id: req.params.leadId,
    ...(req.branchId ? { branchId: req.branchId } : {}),
  }).select('_id');
  if (!lead) throw new ApiError(404, 'Lead not found');

  const notes = await WhatsAppNote.find({ lead: lead._id })
    .populate('user', 'name email')
    .sort({ createdAt: -1 })
    .lean();
  res.json(notes);
});

const getFollowUpsForLead = asyncHandler(async (req, res) => {
  const lead = await Lead.findOne({
    _id: req.params.leadId,
    ...(req.branchId ? { branchId: req.branchId } : {}),
  }).select('_id');
  if (!lead) throw new ApiError(404, 'Lead not found');

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
    if (!conversation) throw new ApiError(404, 'Conversation not found');
    if (conversation.lead) {
      lead = await Lead.findById(conversation.lead);
    }
  } else if (leadId) {
    lead = await Lead.findOne({
      _id: leadId,
      ...(req.branchId ? { branchId: req.branchId } : {}),
    });
    if (!lead) throw new ApiError(404, 'Lead not found');
    const phone = normalizePhone(lead.phone || lead.whatsapp);
    conversation = phone ? await WhatsAppConversation.findOne({ phone }) : null;
    if (!conversation && phone) {
      conversation = await WhatsAppConversation.create({
        phone,
        profileName: lead.name || '',
        lead: lead._id,
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

  const lead = await Lead.findOne({
    _id: leadId,
    ...(req.branchId ? { branchId: req.branchId } : {}),
  });
  if (!lead) throw new ApiError(404, 'Lead not found');

  const note = await WhatsAppNote.create({
    lead: leadId,
    text: text.trim(),
    user: req.user._id,
  });

  const populated = await WhatsAppNote.findById(note._id).populate('user', 'name email').lean();
  res.status(201).json(populated);
});

const updateWhatsAppLead = asyncHandler(async (req, res) => {
  const lead = await Lead.findOneAndUpdate(
    { _id: req.params.id, ...(req.branchId ? { branchId: req.branchId } : {}) },
    req.body,
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
    await WhatsAppConversation.findByIdAndUpdate(conversationId, { unreadCount: 0 });
    await WhatsAppMessage.updateMany(
      { conversation: conversationId, direction: 'incoming' },
      { status: 'read' }
    );
  }

  if (leadId && leadId !== 'none') {
    const lead = await Lead.findOne({
      _id: leadId,
      ...(req.branchId ? { branchId: req.branchId } : {}),
    }).select('_id');
    if (lead) {
      await WhatsAppMessage.updateMany(
        { lead: lead._id, direction: 'incoming' },
        { status: 'read' }
      );
    }
  }

  res.json({ success: true });
});

const createLeadFromChat = asyncHandler(async (req, res) => {
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
    ok: true,
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
