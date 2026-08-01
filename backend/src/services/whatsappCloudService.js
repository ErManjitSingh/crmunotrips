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
    wabaId:
      process.env.WHATSAPP_BUSINESS_ACCOUNT_ID ||
      process.env.WHATSAPP_WABA_ID ||
      '',
    defaultDestination: process.env.WHATSAPP_DEFAULT_DESTINATION || 'Not specified',
    /** Current ads = Facebook → dpw2_wa. Set WHATSAPP_DEFAULT_LEAD_SOURCE=dpw_wa when Google WA is primary. */
    defaultLeadSource: process.env.WHATSAPP_DEFAULT_LEAD_SOURCE || 'dpw2_wa',
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
  // Prefer exact indexed matches first (avoid slow regex scans)
  const exact = await Lead.findOne({
    isDeleted: { $ne: true },
    $or: [
      { phone: phone10 },
      { phone: `91${phone10}` },
      { phone: `+91${phone10}` },
      { whatsapp: phone10 },
      { whatsapp: `91${phone10}` },
      { whatsapp: `+91${phone10}` },
    ],
  })
    .select('_id name phone whatsapp destination status channel branchId')
    .lean();
  if (exact) return exact;

  // Fallback: trailing-digits match (legacy formats)
  const candidates = await Lead.find({
    isDeleted: { $ne: true },
    $or: [
      { phone: new RegExp(`${phone10}$`) },
      { whatsapp: new RegExp(`${phone10}$`) },
    ],
  })
    .select('_id name phone whatsapp destination status channel branchId')
    .limit(8)
    .lean();

  return (
    candidates.find((lead) => {
      const phones = [lead.phone, lead.whatsapp].map((p) => normalizePhone(p));
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

async function upsertConversation({ phone, waId, profileName, text, direction, timestamp, referral }) {
  const phone10 = normalizePhone(phone);
  if (!phone10) return null;

  let conversation = await WhatsAppConversation.findOne({ phone: phone10 });
  let lead = null;
  if (conversation?.lead) {
    lead = await Lead.findById(conversation.lead)
      .select('_id branchId phone whatsapp')
      .lean();
    // Drop wrong auto-link if CRM lead phone ≠ WhatsApp sender
    if (lead) {
      const leadPhones = [lead.phone, lead.whatsapp].map((p) => normalizePhone(p));
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

  const adFromReferral = (() => {
    if (!referral || typeof referral !== 'object') return null;
    const sourceType = String(referral.source_type || referral.sourceType || '').toLowerCase();
    const sourceId = String(referral.source_id || referral.sourceId || '').trim();
    const sourceUrl = String(referral.source_url || referral.sourceUrl || '').trim();
    const headline = String(referral.headline || '').trim();
    const body = String(referral.body || '').trim();
    if (!sourceType && !sourceId && !sourceUrl) return null;
    const isFbAd =
      sourceType === 'ad' ||
      Boolean(sourceId) ||
      /facebook|fb\.com|instagram|meta\.com/i.test(sourceUrl);
    return {
      inboundAdSource: isFbAd ? 'facebook_ad' : 'ad',
      inboundAdMeta: { sourceType, sourceId, sourceUrl, headline, body },
    };
  })();

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
      ...(adFromReferral || {}),
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
    if (adFromReferral && !conversation.inboundAdSource) {
      conversation.inboundAdSource = adFromReferral.inboundAdSource;
      conversation.inboundAdMeta = adFromReferral.inboundAdMeta;
    }
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
  const { resolveInboundAttachment } = require('./whatsappMediaService');
  const { type, attachment } = await resolveInboundAttachment(message);

  return WhatsAppMessage.create({
    conversation: conversation._id,
    lead: leadId || conversation.lead || undefined,
    waMessageId,
    fromPhone: contactPhone,
    direction: 'incoming',
    type,
    text,
    status: 'received',
    timestamp: timestamp || new Date(),
    attachment,
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
            referral: message.referral || null,
          });
          if (!conversation) continue;

          const saved = await storeIncomingMessage({
            conversation,
            leadId: conversation.lead,
            message,
            contactPhone: phone10,
            timestamp: ts,
          });

          // New inbound only (idempotent duplicates return {_id} without direction)
          const isNewInbound = saved && saved.direction === 'incoming';
          if (isNewInbound) {
            setImmediate(() => {
              const { runWhatsAppQuestionnaireBot } = require('./whatsappQuestionnaireBot');
              runWhatsAppQuestionnaireBot({
                conversationId: conversation._id,
                inboundText: text || saved.text || '',
              }).catch((err) => {
                console.error('[whatsappBot] questionnaire failed', err.message);
              });
            });
          }

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
          const errInfo = Array.isArray(status.errors) && status.errors[0] ? status.errors[0] : null;
          const patch = {
            status:
              status.status === 'read'
                ? 'read'
                : status.status === 'delivered'
                  ? 'delivered'
                  : status.status === 'failed'
                    ? 'failed'
                    : 'sent',
          };
          if (errInfo) {
            patch.errorCode = Number(errInfo.code) || null;
            patch.errorMessage = String(errInfo.title || errInfo.message || errInfo.error_data?.details || '').slice(
              0,
              500
            );
          }
          await WhatsAppMessage.updateOne({ waMessageId: status.id }, { $set: patch });
          if (status.status === 'failed') {
            console.warn(
              '[whatsappWebhook] delivery failed',
              status.id,
              patch.errorCode,
              patch.errorMessage || ''
            );
          }
          results.push({
            ok: true,
            type: 'status',
            waMessageId: status.id,
            status: status.status,
            errorCode: patch.errorCode || null,
          });
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

/** Resolve WABA id from env or token scopes (cached briefly). */
let _wabaCache = { id: '', at: 0 };
async function resolveWabaId() {
  const { accessToken, wabaId } = getConfig();
  if (wabaId) return wabaId;
  if (!accessToken) return '';
  if (_wabaCache.id && Date.now() - _wabaCache.at < 10 * 60 * 1000) return _wabaCache.id;

  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/debug_token`);
  url.searchParams.set('input_token', accessToken);
  url.searchParams.set('access_token', accessToken);
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  const scopes = data?.data?.granular_scopes || [];
  const hit =
    scopes.find((s) => s.scope === 'whatsapp_business_management') ||
    scopes.find((s) => s.scope === 'whatsapp_business_messaging');
  const id = String(hit?.target_ids?.[0] || '');
  if (id) _wabaCache = { id, at: Date.now() };
  return id;
}

/** Approved Meta Cloud templates (can open a conversation outside the 24h window). */
async function listMetaMessageTemplates() {
  const { accessToken } = getConfig();
  if (!accessToken) throw new ApiError(503, 'WhatsApp Cloud API is not configured');
  const wabaId = await resolveWabaId();
  if (!wabaId) {
    throw new ApiError(
      503,
      'WhatsApp Business Account ID missing. Set WHATSAPP_BUSINESS_ACCOUNT_ID in backend .env'
    );
  }

  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${wabaId}/message_templates`);
  url.searchParams.set('fields', 'name,status,language,category,components');
  url.searchParams.set('limit', '80');
  url.searchParams.set('access_token', accessToken);

  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(502, data?.error?.message || 'Failed to load Meta templates');
  }

  return (data.data || [])
    .filter((t) => String(t.status || '').toUpperCase() === 'APPROVED')
    .filter((t) => String(t.name || '').toLowerCase() !== 'hello_world')
    .map((t) => {
      const components = Array.isArray(t.components) ? t.components : [];
      const body = components.find((c) => String(c.type).toUpperCase() === 'BODY');
      const header = components.find((c) => String(c.type).toUpperCase() === 'HEADER');
      const bodyText = String(body?.text || '');
      const paramMatches = bodyText.match(/\{\{\d+\}\}/g) || [];
      return {
        name: t.name,
        language: t.language || 'en',
        status: t.status,
        category: t.category || '',
        bodyText,
        headerText: header?.format === 'TEXT' ? String(header.text || '') : '',
        bodyParamCount: paramMatches.length,
        source: 'meta',
      };
    })
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

/** Meta Cloud template (outside 24h session window). */
async function sendWhatsAppTemplate({ toPhone, templateName, languageCode = 'en', components = [] }) {
  const { accessToken, phoneNumberId } = getConfig();
  if (!accessToken || !phoneNumberId) {
    throw new ApiError(503, 'WhatsApp Cloud API is not configured');
  }
  const name = String(templateName || '').trim();
  if (!name) throw new ApiError(400, 'templateName is required');

  const phone10 = normalizePhone(toPhone);
  const to = phone10.length === 10 ? `91${phone10}` : String(toPhone).replace(/\D/g, '');
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name,
      language: { code: languageCode || 'en' },
    },
  };
  if (Array.isArray(components) && components.length) {
    payload.template.components = components;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(502, data?.error?.message || 'WhatsApp template send failed');
  }
  return data;
}

/** True if customer messaged us within the last 24 hours (free-form reply allowed). */
async function hasOpenCustomerSession(conversationId) {
  if (!conversationId) return false;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const inbound = await WhatsAppMessage.findOne({
    conversation: conversationId,
    direction: 'incoming',
    timestamp: { $gte: since },
  })
    .select('_id timestamp')
    .lean();
  return Boolean(inbound);
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

  const answers = conversation.botAnswers || {};
  const adults = answers.adults || answers.travelers || extras.travelers || extras.adults;
  const inbound = String(conversation.inboundAdSource || extras.inboundAdSource || '').toLowerCase();
  const isFbWa = inbound === 'facebook_ad' || inbound === 'ad';
  const isGoogleWa = inbound === 'google' || inbound === 'google_ad';
  // Current traffic is Facebook CTWA; Google Ads WA only when explicitly marked
  let sourceKey = 'dpw2_wa';
  if (isGoogleWa && !isFbWa) sourceKey = 'dpw_wa';
  else if (isFbWa) sourceKey = 'dpw2_wa';
  else if (String(process.env.WHATSAPP_DEFAULT_LEAD_SOURCE || '').toLowerCase() === 'dpw_wa') {
    sourceKey = 'dpw_wa';
  }
  const lead = await ingestPublicLead({
    name: extras.name || conversation.profileName || `WhatsApp ${conversation.phone.slice(-4)}`,
    phone: conversation.phone,
    email: extras.email || '',
    destination:
      extras.destination ||
      answers.destination ||
      getConfig().defaultDestination,
    city: extras.city || '',
    message: extras.message || '',
    transcript,
    travelDate: answers.travelDate || extras.travelDate || undefined,
    travelers: adults || undefined,
    adults: adults || undefined,
    preferredCallTime: answers.bestTimeToCall || extras.preferredCallTime || '',
    notes: answers.bestTimeToCall
      ? `Best time to call: ${answers.bestTimeToCall}`
      : '',
    channel: 'whatsapp',
    source: sourceKey,
    sourceLabel: sourceKey === 'dpw_wa' ? 'DPW WA' : 'DPW2 WA',
    sourceKey,
    inboundAdSource: conversation.inboundAdSource || '',
    waAdSource: conversation.inboundAdSource || '',
    captureType: isFbWa ? 'whatsapp_ctwa' : isGoogleWa ? 'whatsapp_google' : 'whatsapp_chat',
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

  try {
    const { syncBotAnswersToLead } = require('./whatsappQuestionnaireBot');
    await syncBotAnswersToLead(conversation);
  } catch (err) {
    console.error('[whatsappBot] sync on create lead failed', err.message);
  }

  if (actor?._id) {
    // actor optional for activity already logged by ingest
  }

  const refreshed = await Lead.findById(lead._id).lean();
  return { duplicate: false, lead: refreshed || lead };
}

module.exports = {
  getConfig,
  isConfigured,
  verifyWebhookChallenge,
  verifyRequestSignature,
  processWhatsAppWebhook,
  sendWhatsAppText,
  sendWhatsAppTemplate,
  listMetaMessageTemplates,
  resolveWabaId,
  hasOpenCustomerSession,
  createLeadFromConversation,
  normalizePhone,
  upsertConversation,
};
