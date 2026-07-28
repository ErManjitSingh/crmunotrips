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
  FOLLOWUP_LIST_POPULATE,
} = require('../utils/queryHelpers');
const { parsePagination, paginatedResponse } = require('../utils/pagination');
const {
  sendWhatsAppText,
  createLeadFromConversation,
  isConfigured,
  normalizePhone,
} = require('../services/whatsappCloudService');

/** Slim fields for inbox list — avoid shipping full Lead docs */
const INBOX_LEAD_SELECT =
  'name phone whatsapp email city destination status budget travelDate travelers adults source sourceLabel assignedTo leadId updatedAt channel';

const MESSAGE_SELECT = 'direction type text attachment status timestamp waMessageId conversation lead';
const MESSAGE_LIMIT = 150;

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

function mapConversationRow(c, lead) {
  return {
    _id: c._id,
    conversationId: c._id,
    phone: c.phone,
    waId: c.waId || (c.phone ? `91${c.phone}` : ''),
    profileName: c.profileName || '',
    leadId: lead?._id || null,
    lead: lead || null,
    hasLead: Boolean(lead),
    botStep: c.botStep || 'idle',
    botAnswers: c.botAnswers || null,
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
}

async function loadRecentMessages(filter) {
  const rows = await WhatsAppMessage.find(filter)
    .select(MESSAGE_SELECT)
    .sort({ timestamp: -1 })
    .limit(MESSAGE_LIMIT)
    .lean();
  rows.reverse();
  return rows;
}

const listConversations = asyncHandler(async (req, res) => {
  const { status, search, onlyUnlinked, includeOrphans } = req.query;
  const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 40, maxLimit: 100 });
  const executiveOnly = isSalesExecutive(req);
  const wantOrphans = includeOrphans === '1' || includeOrphans === 'true';

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

  // Resolve lead id scopes once (executive + status) — filter in Mongo, not JS
  let scopedLeadIds = null;
  if (executiveOnly || status) {
    const leadFilter = leadScopeFilter(req);
    if (status) leadFilter.status = status;
    scopedLeadIds = await Lead.find(leadFilter).select('_id').lean();
    const ids = scopedLeadIds.map((l) => l._id);
    if (!ids.length) {
      return res.json(paginatedResponse([], { page, limit, total: 0 }));
    }
    filter.lead = { $in: ids };
  } else if (onlyUnlinked === '1' || onlyUnlinked === 'true') {
    filter.lead = null;
  }

  if (search) {
    const q = String(search).trim();
    const digits = q.replace(/\D/g, '').slice(-10);
    const searchOr = [];
    if (digits) searchOr.push({ phone: digits });
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      searchOr.push({ profileName: rx }, { lastMessageText: rx });
    }
    if (searchOr.length) {
      if (filter.$and) filter.$and.push({ $or: searchOr });
      else filter.$or = searchOr;
    }
  }

  // Skip expensive countDocuments on inbox — total ≈ page size is enough for UI
  const conversations = await WhatsAppConversation.find(filter)
    .populate({
      path: 'lead',
      select: INBOX_LEAD_SELECT,
      populate: [{ path: 'assignedTo', select: 'name email' }],
    })
    .sort({ lastMessageAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  let rows = conversations.map((c) => {
    const lead = c.lead ? enrichLead(c.lead) : null;
    if (executiveOnly && !lead) return null;
    return mapConversationRow(c, lead);
  }).filter(Boolean);

  // Legacy orphan leads — off by default (slow); enable with ?includeOrphans=1
  if (wantOrphans && !onlyUnlinked && page === 1) {
    const leadFilter = leadScopeFilter(req, { channel: 'whatsapp' });
    if (status) leadFilter.status = status;
    const linkedPhones = new Set(rows.filter((r) => r.leadId).map((r) => normalizePhone(r.phone)));
    const orphanLeads = await Lead.find(leadFilter)
      .select(INBOX_LEAD_SELECT)
      .populate([{ path: 'assignedTo', select: 'name email' }])
      .sort({ updatedAt: -1 })
      .limit(15)
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
        botStep: null,
        botAnswers: null,
        lastMessage: null,
        unreadCount: 0,
        updatedAt: lead.updatedAt,
      });
    }
    rows.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
  }

  const pageRows = rows.slice(0, limit);
  res.json(
    paginatedResponse(pageRows, {
      page,
      limit,
      total: skip + pageRows.length + (pageRows.length === limit ? 1 : 0),
    })
  );
});

const getMessagesByConversation = asyncHandler(async (req, res) => {
  const conversation = await WhatsAppConversation.findById(req.params.conversationId)
    .select('_id lead')
    .lean();
  await assertConversationAccess(req, conversation);
  const messages = await loadRecentMessages({ conversation: conversation._id });
  res.json(messages);
});

const getMessages = asyncHandler(async (req, res) => {
  const lead = await findScopedLead(req, req.params.leadId, '_id phone whatsapp');
  const phone = normalizePhone(lead.phone || lead.whatsapp);
  const conversation = phone
    ? await WhatsAppConversation.findOne({ phone }).select('_id').lean()
    : null;

  const filter = conversation
    ? { $or: [{ lead: lead._id }, { conversation: conversation._id }] }
    : { lead: lead._id };

  const messages = await loadRecentMessages(filter);
  res.json(messages);
});

/** Single round-trip for chat open: messages (+ notes/followups when lead linked) */
const getThread = asyncHandler(async (req, res) => {
  const conversationId = req.query.conversationId || req.body?.conversationId;
  const leadId = req.query.leadId || req.body?.leadId;
  const includeMeta = req.query.meta !== '0' && req.query.meta !== 'false';

  let conversation = null;
  let lead = null;

  if (conversationId) {
    conversation = await WhatsAppConversation.findById(conversationId)
      .select('_id lead phone botAnswers botStep')
      .lean();
    await assertConversationAccess(req, conversation);
    if (conversation.lead) {
      lead = await findScopedLead(req, conversation.lead, '_id');
    }
  } else if (leadId) {
    lead = await findScopedLead(req, leadId, '_id phone whatsapp');
  } else {
    throw new ApiError(400, 'conversationId or leadId is required');
  }

  const msgFilter = conversation
    ? lead
      ? { $or: [{ conversation: conversation._id }, { lead: lead._id }] }
      : { conversation: conversation._id }
    : { lead: lead._id };

  const messagesPromise = loadRecentMessages(msgFilter);

  let notesPromise = Promise.resolve([]);
  let followupsPromise = Promise.resolve([]);
  if (includeMeta && lead?._id) {
    notesPromise = WhatsAppNote.find({ lead: lead._id })
      .select('text createdAt user')
      .populate('user', 'name')
      .sort({ createdAt: -1 })
      .limit(40)
      .lean();
    followupsPromise = FollowUp.find({
      lead: lead._id,
      ...(req.branchId ? { branchId: req.branchId } : {}),
    })
      .select('scheduledAt status category remarks outcome createdAt assignedTo')
      .populate(FOLLOWUP_LIST_POPULATE)
      .sort({ scheduledAt: -1 })
      .limit(20)
      .lean();
  }

  const [messages, notes, followups] = await Promise.all([
    messagesPromise,
    notesPromise,
    followupsPromise,
  ]);

  res.json({
    messages,
    notes,
    followups,
    botAnswers: conversation?.botAnswers || null,
    botStep: conversation?.botStep || null,
  });
});

const getNotes = asyncHandler(async (req, res) => {
  const lead = await findScopedLead(req, req.params.leadId, '_id');
  const notes = await WhatsAppNote.find({ lead: lead._id })
    .select('text createdAt user')
    .populate('user', 'name')
    .sort({ createdAt: -1 })
    .limit(40)
    .lean();
  res.json(notes);
});

const getFollowUpsForLead = asyncHandler(async (req, res) => {
  const lead = await findScopedLead(req, req.params.leadId, '_id');
  const followups = await FollowUp.find({
    lead: lead._id,
    ...(req.branchId ? { branchId: req.branchId } : {}),
  })
    .select('scheduledAt status category remarks outcome createdAt assignedTo')
    .populate(FOLLOWUP_LIST_POPULATE)
    .sort({ scheduledAt: -1 })
    .limit(20)
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
        botEnabled: false,
        botStep: 'paused',
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

  const now = new Date();
  const [msg] = await Promise.all([
    WhatsAppMessage.create({
      conversation: conversation?._id,
      lead: lead?._id || conversation?.lead || undefined,
      waMessageId,
      fromPhone: toPhone || '',
      direction: 'outgoing',
      type,
      text: text || '',
      attachment: attachment || null,
      status,
      timestamp: now,
      sentBy: req.user._id,
    }),
    conversation
      ? WhatsAppConversation.updateOne(
          { _id: conversation._id },
          {
            $set: {
              lastMessageText: text || conversation.lastMessageText,
              lastMessageAt: now,
              lastDirection: 'outgoing',
              botStep: conversation.botStep === 'completed' ? 'completed' : 'paused',
              botEnabled: false,
            },
          }
        )
      : Promise.resolve(),
  ]);

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

  const populated = await WhatsAppNote.findById(note._id)
    .select('text createdAt user')
    .populate('user', 'name')
    .lean();
  res.status(201).json(populated);
});

const updateWhatsAppLead = asyncHandler(async (req, res) => {
  const body = { ...req.body };
  if (isSalesExecutive(req)) {
    delete body.assignedTo;
  }

  const lead = await Lead.findOneAndUpdate(
    leadScopeFilter(req, { _id: req.params.id }),
    body,
    { new: true, runValidators: true }
  )
    .select(INBOX_LEAD_SELECT)
    .populate([{ path: 'assignedTo', select: 'name email' }])
    .lean();
  if (!lead) throw new ApiError(404, 'Lead not found');

  // Sync bot answers only when assigning (or if travel fields empty)
  const needsSync =
    body.assignedTo ||
    (!lead.travelDate && !lead.travelers);
  if (needsSync) {
    try {
      const conversation = await WhatsAppConversation.findOne({ lead: lead._id })
        .select('lead botAnswers')
        .lean();
      if (conversation?.botAnswers) {
        const { syncBotAnswersToLead } = require('../services/whatsappQuestionnaireBot');
        await syncBotAnswersToLead(conversation);
        const refreshed = await Lead.findById(lead._id)
          .select(INBOX_LEAD_SELECT)
          .populate([{ path: 'assignedTo', select: 'name email' }])
          .lean();
        return res.json(enrichLead(refreshed || lead));
      }
    } catch (err) {
      console.error('[whatsappBot] sync on lead update failed', err.message);
    }
  }

  res.json(enrichLead(lead));
});

const markRead = asyncHandler(async (req, res) => {
  const { leadId } = req.params;
  const conversationId = req.query.conversationId || req.body?.conversationId;

  // Inbox only needs unreadCount=0 — skip heavy updateMany on all messages
  if (conversationId) {
    const conversation = await WhatsAppConversation.findById(conversationId)
      .select('_id lead unreadCount')
      .lean();
    await assertConversationAccess(req, conversation);
    if (conversation.unreadCount) {
      await WhatsAppConversation.updateOne({ _id: conversationId }, { $set: { unreadCount: 0 } });
    }
  } else if (leadId && leadId !== 'none') {
    const lead = await findScopedLead(req, leadId, '_id phone whatsapp');
    const phone = normalizePhone(lead.phone || lead.whatsapp);
    if (phone) {
      await WhatsAppConversation.updateOne({ phone }, { $set: { unreadCount: 0 } });
    }
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
      travelDate: result.lead?.travelDate,
      travelers: result.lead?.travelers,
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
  getThread,
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
