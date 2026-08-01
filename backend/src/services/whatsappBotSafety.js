/**
 * WhatsApp Cloud quality / anti-spam guards.
 * Goal: only user-initiated, low-volume, opt-out aware replies so Meta
 * quality rating stays healthy and competitors cannot easily burn the number.
 */
const WhatsAppConversation = require('../models/WhatsAppConversation');
const WhatsAppMessage = require('../models/WhatsAppMessage');

/** Min gap between two bot replies to same chat (ms) */
const MIN_BOT_GAP_MS = 2800;
/** Max bot outbound messages per chat in rolling 24h */
const MAX_BOT_PER_CHAT_24H = 10;
/** Max bot outbound messages in one questionnaire session */
const MAX_BOT_PER_SESSION = 8;
/** Max re-asks for a single question */
const MAX_REASKS = 1;
/** Don't restart completed flow sooner than this (ms) */
const RESTART_COOLDOWN_MS = 48 * 60 * 60 * 1000;
/** Global bot sends across all chats (rolling window) */
const GLOBAL_WINDOW_MS = 60 * 1000;
const GLOBAL_MAX_PER_WINDOW = 25;

const globalSendTimestamps = [];

const STOP_REPLY =
  'Understood. Automated messages have been paused.\n\nYou can reply START anytime to resume.\nOur team will contact you only when needed.';

const START_REPLY =
  'Thank you! Automated assistance is now on.\n\nSend any message and we will guide you through a few quick trip details.';

function normalizeText(text = '') {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isOptOutRequest(text = '') {
  const t = normalizeText(text);
  if (!t) return false;
  return /^(stop|unsubscribe|opt\s*out|optout|cancel|band|band\s*karo|rok\s*do|no\s*more|dont\s*message|don't\s*message|nahi\s*chahiye|remove|block)$/.test(
    t
  ) || /^(stop|unsubscribe|opt\s*out)\b/.test(t);
}

function isOptInRequest(text = '') {
  const t = normalizeText(text);
  return /^(start|subscribe|opt\s*in|optin|unstop|resume)$/.test(t);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function allowGlobalSend() {
  const now = Date.now();
  while (globalSendTimestamps.length && now - globalSendTimestamps[0] > GLOBAL_WINDOW_MS) {
    globalSendTimestamps.shift();
  }
  if (globalSendTimestamps.length >= GLOBAL_MAX_PER_WINDOW) return false;
  globalSendTimestamps.push(now);
  return true;
}

async function countBotMessagesSince(conversationId, since) {
  return WhatsAppMessage.countDocuments({
    conversation: conversationId,
    direction: 'outgoing',
    sentBy: { $exists: false },
    timestamp: { $gte: since },
  });
}

async function assertCanSendBot(conversation) {
  if (!conversation) return { ok: false, reason: 'missing' };
  if (conversation.botOptOut === true || conversation.botEnabled === false) {
    return { ok: false, reason: 'opted_out' };
  }
  if (conversation.botBlockedUntil && new Date(conversation.botBlockedUntil) > new Date()) {
    return { ok: false, reason: 'temporarily_blocked' };
  }
  if (!allowGlobalSend()) {
    return { ok: false, reason: 'global_rate_limit' };
  }

  const lastSent = conversation.botLastSentAt ? new Date(conversation.botLastSentAt).getTime() : 0;
  const gap = Date.now() - lastSent;
  if (lastSent && gap < MIN_BOT_GAP_MS) {
    await sleep(MIN_BOT_GAP_MS - gap);
  }

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const dayCount = await countBotMessagesSince(conversation._id, since24h);
  if (dayCount >= MAX_BOT_PER_CHAT_24H) {
    await WhatsAppConversation.updateOne(
      { _id: conversation._id },
      { $set: { botBlockedUntil: new Date(Date.now() + 6 * 60 * 60 * 1000) } }
    );
    return { ok: false, reason: 'daily_chat_limit' };
  }

  const sessionStart = conversation.botSessionStartedAt
    ? new Date(conversation.botSessionStartedAt)
    : since24h;
  const sessionCount = await countBotMessagesSince(conversation._id, sessionStart);
  if (sessionCount >= MAX_BOT_PER_SESSION) {
    return { ok: false, reason: 'session_limit' };
  }

  return { ok: true };
}

async function markBotSent(conversationId) {
  await WhatsAppConversation.updateOne(
    { _id: conversationId },
    {
      $set: { botLastSentAt: new Date() },
      $inc: { botSentCount: 1 },
    }
  );
}

async function applyOptOut(conversationId) {
  await WhatsAppConversation.updateOne(
    { _id: conversationId },
    {
      $set: {
        botOptOut: true,
        botEnabled: false,
        botStep: 'paused',
        botOptOutAt: new Date(),
      },
    }
  );
}

async function applyOptIn(conversationId) {
  await WhatsAppConversation.updateOne(
    { _id: conversationId },
    {
      $set: {
        botOptOut: false,
        botEnabled: true,
        botStep: 'idle',
        botOptOutAt: null,
        botBlockedUntil: null,
        botReaskCount: 0,
      },
    }
  );
}

function canRestartCompleted(conversation) {
  const doneAt =
    conversation?.botAnswers?.completedAt ||
    conversation?.botCompletedAt ||
    null;
  if (!doneAt) return true;
  return Date.now() - new Date(doneAt).getTime() >= RESTART_COOLDOWN_MS;
}

module.exports = {
  STOP_REPLY,
  START_REPLY,
  MAX_REASKS,
  RESTART_COOLDOWN_MS,
  isOptOutRequest,
  isOptInRequest,
  assertCanSendBot,
  markBotSent,
  applyOptOut,
  applyOptIn,
  canRestartCompleted,
  normalizeText,
};
