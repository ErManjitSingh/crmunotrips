const crypto = require('crypto');
const WhatsAppConversation = require('../models/WhatsAppConversation');
const WhatsAppMessage = require('../models/WhatsAppMessage');
const Lead = require('../models/Lead');
const ApiError = require('../utils/apiError');
const { ingestPublicLead, digitsPhone } = require('./publicLeadIngestService');

const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || process.env.FACEBOOK_GRAPH_VERSION || 'v21.0';

function getConfig() {
  return {
    verifyToken:
      process.env.WHATSAPP_VERIFY_TOKEN ||
      process.env.FACEBOOK_VERIFY_TOKEN ||
      '',
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_TOKEN || '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    appSecret: process.env.WHATSAPP_APP_SECRET || process.env.FACEBOOK_APP_SECRET || '',
    defaultDestination: process.env.WHATSAPP_DEFAULT_DESTINATION || 'Not specified',
  };
}

function isConfigured() {
  const { accessToken, phoneNumberId, verifyToken } = getConfig();
  return Boolean(accessToken && phoneNumberId && verifyToken);
}

function verifyWebhookChallenge(query = {}) {
  const { verifyToken } = getConfig();
  const mode = String(query['hub.mode'] || '');
  const token = String(query['hub.verify_token'] || '');
  const challenge = String(query['hub.challenge'] || '');
  if (!verifyToken) throw new ApiError(503, 'WHATSAPP_VERIFY_TOKEN is not configured');
  if (mode === 'subscribe' && token === verifyToken && challenge) return challenge;
  throw new ApiError(403, 'WhatsApp webhook verification failed');
}

function verifyRequestSignature(rawBody, signatureHeader) {
  const { appSecret } = getConfig();
  if (!appSecret) return true;
  if (!signatureHeader || !rawBody) return false;
  const expected =
    'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(signatureHeader)));
  } catch {
    return false;
  }
}

function normalizePhone(raw = '') {
  const digits = digitsPhone(raw);
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

function extractMessageText(message = {}) {
  if (message.text?.body) return String(message.text.body).trim();
  if (message.button?.text) return String(message.button.text).trim();
  if (message.interactive?.button_reply?.title) {
    return String(message.interactive.button_reply.title).trim();
  }
  if (message.image?.caption) return String(message.image.caption).trim();
  if (message.document?.caption) return String(message.document.caption).trim();
  if (message.type === 'image') return '[Image]';
  if (message.type === 'document') return '[Document]';
  if (message.type === 'audio') return '[Audio]';
  if (message.type === 'video') return '[Video]';
  if (message.type === 'sticker') return '[Sticker]';
  return '';
}

function mapMessageType(type) {
  if (['text', 'image', 'document', 'audio', 'video'].includes(type)) return type;
  return 'unknown';
}

async function findLeadByPhone(phone10) {
  if (!phone10 || phone10.length < 10) return null;
  // Exact last-10 digit match only (avoid false links to other leads)
  const candidates = await Lead.find({
    isDeleted: { $ne: true },
    $or: [
      { phone: new RegExp(`${phone10}$`) },
      { whatsapp: new RegExp(`${phone10}$`) },
      { alternatePhone: new RegExp(`${phone10}$`) },
    ],
  })
    .select('_id name phone whatsapp alternatePhone destination status channel branchId')
    .limit(20)
    .lean();

  return (
    candidates.find((lead) => {
      const phones = [lead.phone, lead.whatsapp, lead.alternatePhone].map((p) => normalizePhone(p));
      return phones.includes(phone10);
    }) || null
  );
}

async function resolveWhatsAppBranchId(lead) {
  if (lead?.branchId) return lead.branchId;
  const fromEnv = process.env.WHATSAPP_DEFAULT_BRANCH_ID || process.env.PUBLIC_LEAD_BRANCH_ID;
  if (fromEnv) return fromEnv;
  try {
    const { resolvePublicBranchId } = require('./publicLeadIngestService');
    return await resolvePublicBranchId();
  } catch {
    return null;
  }
}

async function upsertConversation({ phone, waId, profileName, text, direction, timestamp }) {
  const phone10 = normalizePhone(phone);
  if (!phone10) return null;

  let conversation = await WhatsAppConversation.findOne({ phone: phone10 });
  let lead = null;
  if (conversation?.lead) {
    lead = await Lead.findById(conversation.lead)
      .select('_id branchId phone whatsapp alternatePhone')
      .lean();
    // Drop wrong auto-link if CRM lead phone ≠ WhatsApp sender
    if (lead) {
      const leadPhones = [lead.phone, lead.whatsapp, lead.alternatePhone].map((p) => normalizePhone(p));
      if (!leadPhones.includes(phone10)) {
        conversation.lead = null;
        lead = null;
        await conversation.save();
      }
    }
  }
  if (!lead) {
    lead = await findLeadByPhone(phone10);
  }
  const branchId = await resolveWhatsAppBranchId(lead);

  if (!conversation) {
    conversation = await WhatsAppConversation.create({
      phone: phone10,
      waId: waId || phone10,
      profileName: profileName || '',
      lastMessageText: text || '',
      lastMessageAt: timestamp || new Date(),
      lastDirection: direction,
      unreadCount: direction === 'incoming' ? 1 : 0,
      lead: lead?._id || null,
      branchId: branchId || undefined,
    });
  } else {
    conversation.profileName = profileName || conversation.profileName;
    conversation.waId = waId || conversation.waId;
    conversation.lastMessageText = text || conversation.lastMessageText;
    conversation.lastMessageAt = timestamp || new Date();
    conversation.lastDirection = direction;
    if (direction === 'incoming') conversation.unreadCount = (conversation.unreadCount || 0) + 1;
    if (!conversation.lead && lead?._id) conversation.lead = lead._id;
    if (!conversation.branchId && branchId) conversation.branchId = branchId;
    await conversation.save();
  }

  return conversation;
}

async function storeIncomingMessage({ conversation, leadId, message, contactPhone, timestamp }) {
  const waMessageId = message.id || undefined;
  if (waMessageId) {
    const existing = await WhatsAppMessage.findOne({ waMessageId }).select('_id').lean();
    if (existing) return existing;
  }

  const text = extractMessageText(message);
  return WhatsAppMessage.create({
    conversation: conversation._id,
    lead: leadId || conversation.lead || undefined,
    waMessageId,
    fromPhone: contactPhone,
    direction: 'incoming',
    type: mapMessageType(message.type),
    text,
    status: 'received',
    timestamp: timestamp || new Date(),
    attachment: message.image || message.document || message.audio || message.video || null,
  });
}

async function processWhatsAppWebhook(body = {}) {
  const entries = Array.isArray(body.entry) ? body.entry : [];
  const results = [];

  for (const entry of entries) {
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];
    for (const change of changes) {
      const value = change?.value || {};
      const contacts = Array.isArray(value.contacts) ? value.contacts : [];
      const messages = Array.isArray(value.messages) ? value.messages : [];
      const statuses = Array.isArray(value.statuses) ? value.statuses : [];

      for (const message of messages) {
        try {
          const from = message.from || '';
          const phone10 = normalizePhone(from);
          const contact = contacts.find((c) => normalizePhone(c.wa_id || c.waId) === phone10) || contacts[0];
          const profileName = contact?.profile?.name || '';
          const ts = message.timestamp
            ? new Date(Number(message.timestamp) * 1000)
            : new Date();
          const text = extractMessageText(message);

          const conversation = await upsertConversation({
            phone: phone10,
            waId: from,
            profileName,
            text,
            direction: 'incoming',
            timestamp: ts,
          });
          if (!conversation) continue;

          const saved = await storeIncomingMessage({
            conversation,
            leadId: conversation.lead,
            message,
            contactPhone: phone10,
            timestamp: ts,
          });

          results.push({
            ok: true,
            type: 'message',
            phone: phone10,
            conversationId: conversation._id,
            messageId: saved?._id,
            hasLead: Boolean(conversation.lead),
          });
        } catch (err) {
          console.error('[whatsappWebhook] message failed', err.message);
          results.push({ ok: false, type: 'message', message: err.message });
        }
      }

      for (const status of statuses) {
        try {
          if (!status.id) continue;
          await WhatsAppMessage.updateOne(
            { waMessageId: status.id },
            {
              status:
                status.status === 'read'
                  ? 'read'
                  : status.status === 'delivered'
                    ? 'delivered'
                    : status.status === 'failed'
                      ? 'failed'
                      : 'sent',
            }
          );
          results.push({ ok: true, type: 'status', waMessageId: status.id, status: status.status });
        } catch (err) {
          results.push({ ok: false, type: 'status', message: err.message });
        }
      }
    }
  }

  return { received: results.length, results };
}

async function sendWhatsAppText({ toPhone, text }) {
  const { accessToken, phoneNumberId } = getConfig();
  if (!accessToken || !phoneNumberId) {
    throw new ApiError(503, 'WhatsApp Cloud API is not configured');
  }

  const phone10 = normalizePhone(toPhone);
  const to = phone10.length === 10 ? `91${phone10}` : String(toPhone).replace(/\D/g, '');

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(502, data?.error?.message || 'WhatsApp send failed');
  }
  return data;
}

async function createLeadFromConversation(conversationId, extras = {}, actor = null) {
  const conversation = await WhatsAppConversation.findById(conversationId);
  if (!conversation) throw new ApiError(404, 'Conversation not found');
  if (conversation.lead) {
    const existing = await Lead.findById(conversation.lead).lean();
    return { duplicate: true, lead: existing };
  }

  const recent = await WhatsAppMessage.find({ conversation: conversation._id })
    .sort({ timestamp: -1 })
    .limit(20)
    .lean();
  const transcript = recent
    .slice()
    .reverse()
    .map((m) => `${m.direction === 'incoming' ? 'Customer' : 'Agent'}: ${m.text || ''}`)
    .filter((line) => line.trim().length > 10)
    .join('\n');

  const lead = await ingestPublicLead({
    name: extras.name || conversation.profileName || `WhatsApp ${conversation.phone.slice(-4)}`,
    phone: conversation.phone,
    email: extras.email || '',
    destination: extras.destination || getConfig().defaultDestination,
    city: extras.city || '',
    message: extras.message || '',
    transcript,
    channel: 'whatsapp',
    source: 'WhatsApp',
    sourceLabel: 'WhatsApp',
    sourceKey: 'whatsapp',
    captureType: 'whatsapp_chat',
  });

  conversation.lead = lead._id;
  if (lead.branchId) conversation.branchId = lead.branchId;
  await conversation.save();
  await WhatsAppMessage.updateMany(
    { conversation: conversation._id, lead: { $exists: false } },
    { $set: { lead: lead._id } }
  );
  await WhatsAppMessage.updateMany(
    { conversation: conversation._id, lead: null },
    { $set: { lead: lead._id } }
  );

  if (actor?._id) {
    // actor optional for activity already logged by ingest
  }

  return { duplicate: false, lead };
}

module.exports = {
  getConfig,
  isConfigured,
  verifyWebhookChallenge,
  verifyRequestSignature,
  processWhatsAppWebhook,
  sendWhatsAppText,
  createLeadFromConversation,
  normalizePhone,
  upsertConversation,
};
