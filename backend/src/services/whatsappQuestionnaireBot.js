const WhatsAppConversation = require('../models/WhatsAppConversation');
const WhatsAppMessage = require('../models/WhatsAppMessage');
const Lead = require('../models/Lead');
const {
  STOP_REPLY,
  START_REPLY,
  MAX_REASKS,
  isOptOutRequest,
  isOptInRequest,
  assertCanSendBot,
  markBotSent,
  applyOptOut,
  applyOptIn,
  canRestartCompleted,
} = require('./whatsappBotSafety');

/**
 * Keep copy short + helpful. Long marketing blasts hurt Meta quality rating.
 * First message mentions STOP so users (and Meta) see clear opt-out.
 */
const QUESTIONS = {
  travelDate:
    'Namaste! Uno Trips 👋\n\nKab travel karna hai?\n(jaise: 15/08/2026)\n\n_Auto band karne ke liye STOP likhein._',
  travelers: 'Great — kitne travelers hain?\n(sirf number, jaise: 4)',
  done: 'Shukriya! Details save ho gayi hain.\nHamari team jaldi contact karegi.',
  reaskTravelDate: 'Date dobara bhejein (jaise: 15/08/2026).',
  reaskTravelers: 'Sirf number likhein (jaise: 2 ya 4).',
};

function isMediaPlaceholder(text = '') {
  return /^\[(Image|Document|Audio|Video|Sticker)\]$/i.test(String(text).trim());
}

/** Auto Q&A starts only on greeting messages */
function isGreeting(text = '') {
  const t = String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return false;

  if (
    /^(hi+|h+i+o*|hello+|hey+|helo+|hellow+|hlo+|namaste|namaskar|hola|yo+|sup|hai+|hy+)$/.test(t)
  ) {
    return true;
  }

  if (/^good\s*(morning|evening|afternoon|night)$/.test(t)) return true;

  if (
    /^(hi+|hello+|hey+|namaste|namaskar)\b/.test(t) &&
    t.split(' ').length <= 4 &&
    t.length <= 28
  ) {
    return true;
  }

  return false;
}

function parseTravelDate(raw = '') {
  const text = String(raw || '').trim();
  if (!text) return null;

  const dmy = text.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (dmy) {
    let [, dd, mm, yyyy] = dmy;
    dd = Number(dd);
    mm = Number(mm);
    yyyy = Number(yyyy);
    if (yyyy < 100) yyyy += 2000;
    const d = new Date(yyyy, mm - 1, dd);
    if (d.getFullYear() === yyyy && d.getMonth() === mm - 1 && d.getDate() === dd) {
      return d;
    }
  }

  const parsed = Date.parse(text);
  if (!Number.isNaN(parsed)) {
    const d = new Date(parsed);
    if (!Number.isNaN(d.getTime())) return d;
  }

  return null;
}

function parseTravelers(raw = '') {
  const match = String(raw || '').match(/(\d{1,3})/);
  if (!match) return null;
  const n = Number(match[1]);
  if (!Number.isFinite(n) || n < 1 || n > 200) return null;
  return n;
}

async function sendAndStoreBotReply(conversation, text) {
  const gate = await assertCanSendBot(conversation);
  if (!gate.ok) {
    console.warn('[whatsappBot] send blocked', conversation?.phone, gate.reason);
    return null;
  }

  const { sendWhatsAppText } = require('./whatsappCloudService');
  const phone = conversation.phone;
  let waMessageId;
  try {
    const data = await sendWhatsAppText({ toPhone: phone, text });
    waMessageId = data?.messages?.[0]?.id;
  } catch (err) {
    const msg = String(err.message || '');
    // Meta spam / quality / rate errors → hard pause this chat
    if (/spam|restrict|quality|rate|too many|131047|131026|130429/i.test(msg)) {
      await WhatsAppConversation.updateOne(
        { _id: conversation._id },
        {
          $set: {
            botEnabled: false,
            botStep: 'paused',
            botBlockedUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        }
      );
    }
    console.error('[whatsappBot] send failed', err.message);
    throw err;
  }

  const now = new Date();
  await Promise.all([
    WhatsAppMessage.create({
      conversation: conversation._id,
      lead: conversation.lead || undefined,
      waMessageId,
      fromPhone: phone,
      direction: 'outgoing',
      type: 'text',
      text,
      status: 'sent',
      timestamp: now,
      // no sentBy → counts as bot message for safety limits
    }),
    WhatsAppConversation.updateOne(
      { _id: conversation._id },
      {
        $set: {
          lastMessageText: text,
          lastMessageAt: now,
          lastDirection: 'outgoing',
        },
      }
    ),
    markBotSent(conversation._id),
  ]);

  conversation.botLastSentAt = now;
  return true;
}

async function syncBotAnswersToLead(conversation) {
  if (!conversation?.lead) return null;
  const answers = conversation.botAnswers || {};
  const update = {};

  if (answers.travelDate) update.travelDate = answers.travelDate;
  if (answers.travelers) {
    update.travelers = answers.travelers;
    update.adults = answers.travelers;
  }

  if (!Object.keys(update).length) return null;
  return Lead.updateOne({ _id: conversation.lead }, { $set: update });
}

async function askTravelDate(conversation) {
  const claimed = await WhatsAppConversation.findOneAndUpdate(
    {
      _id: conversation._id,
      botEnabled: { $ne: false },
      botOptOut: { $ne: true },
      botStep: { $in: [null, undefined, 'idle'] },
    },
    {
      $set: {
        botStep: 'await_travel_date',
        botSessionStartedAt: new Date(),
        botReaskCount: 0,
      },
    },
    { new: true }
  );
  if (!claimed) return;
  await sendAndStoreBotReply(claimed, QUESTIONS.travelDate);
}

async function maybeReask(conversation, step, replyText) {
  const count = Number(conversation.botReaskCount || 0);
  if (count >= MAX_REASKS) {
    // Stop looping — hand off to human quietly
    await WhatsAppConversation.updateOne(
      { _id: conversation._id },
      { $set: { botStep: 'paused', botEnabled: false, botReaskCount: 0 } }
    );
    await sendAndStoreBotReply(
      conversation,
      'Theek hai — team member aapse personally baat karega.'
    );
    return false;
  }
  await WhatsAppConversation.updateOne(
    { _id: conversation._id },
    { $inc: { botReaskCount: 1 } }
  );
  conversation.botReaskCount = count + 1;
  await sendAndStoreBotReply(conversation, replyText);
  return true;
}

async function handleTravelDateAnswer(conversation, text) {
  const travelDate = parseTravelDate(text);
  if (!text || isMediaPlaceholder(text)) {
    await maybeReask(conversation, 'await_travel_date', QUESTIONS.reaskTravelDate);
    return;
  }

  const claimed = await WhatsAppConversation.findOneAndUpdate(
    {
      _id: conversation._id,
      botEnabled: { $ne: false },
      botOptOut: { $ne: true },
      botStep: 'await_travel_date',
    },
    {
      $set: {
        botStep: 'await_travelers',
        botReaskCount: 0,
        'botAnswers.travelDateRaw': text,
        ...(travelDate ? { 'botAnswers.travelDate': travelDate } : {}),
      },
    },
    { new: true }
  );
  if (!claimed) return;

  await syncBotAnswersToLead(claimed);
  await sendAndStoreBotReply(claimed, QUESTIONS.travelers);
}

async function handleTravelersAnswer(conversation, text) {
  const travelers = parseTravelers(text);
  if (!travelers) {
    await maybeReask(conversation, 'await_travelers', QUESTIONS.reaskTravelers);
    return;
  }

  const claimed = await WhatsAppConversation.findOneAndUpdate(
    {
      _id: conversation._id,
      botEnabled: { $ne: false },
      botOptOut: { $ne: true },
      botStep: 'await_travelers',
    },
    {
      $set: {
        botStep: 'completed',
        botReaskCount: 0,
        botCompletedAt: new Date(),
        'botAnswers.travelersRaw': text,
        'botAnswers.travelers': travelers,
        'botAnswers.completedAt': new Date(),
      },
    },
    { new: true }
  );
  if (!claimed) return;

  await syncBotAnswersToLead(claimed);
  await sendAndStoreBotReply(claimed, QUESTIONS.done);
}

/**
 * Run after a newly stored inbound WhatsApp message.
 * Non-blocking caller should catch errors.
 */
async function runWhatsAppQuestionnaireBot({ conversationId, inboundText }) {
  if (!conversationId) return { skipped: true, reason: 'no_conversation' };

  const conversation = await WhatsAppConversation.findById(conversationId);
  if (!conversation) return { skipped: true, reason: 'missing' };

  const text = String(inboundText || '').trim();

  // Always honor STOP / START first (compliance + quality)
  if (isOptOutRequest(text)) {
    await applyOptOut(conversation._id);
    const fresh = await WhatsAppConversation.findById(conversationId);
    // allow one confirmation even if opted out — temporary override
    if (fresh) {
      fresh.botOptOut = false;
      fresh.botEnabled = true;
      await sendAndStoreBotReply(fresh, STOP_REPLY);
      await applyOptOut(conversation._id);
    }
    return { ok: true, optedOut: true };
  }

  if (isOptInRequest(text)) {
    await applyOptIn(conversation._id);
    const fresh = await WhatsAppConversation.findById(conversationId);
    if (fresh) await sendAndStoreBotReply(fresh, START_REPLY);
    return { ok: true, optedIn: true };
  }

  const step = conversation.botStep || 'idle';
  if (step === 'paused' || conversation.botEnabled === false || conversation.botOptOut === true) {
    return { skipped: true, reason: 'paused_or_opted_out' };
  }

  // Start only on greeting; completed chats have 48h cooldown (anti-abuse)
  if (step === 'idle' || step === 'completed') {
    if (!isGreeting(text)) {
      return { skipped: true, reason: step === 'idle' ? 'waiting_for_greeting' : 'completed' };
    }
    if (step === 'completed' && !canRestartCompleted(conversation)) {
      return { skipped: true, reason: 'restart_cooldown' };
    }
    if (step === 'completed') {
      await WhatsAppConversation.updateOne(
        { _id: conversation._id },
        {
          $set: {
            botStep: 'idle',
            botAnswers: {},
            botReaskCount: 0,
          },
        }
      );
      conversation.botStep = 'idle';
      conversation.botAnswers = {};
    }
    await askTravelDate(conversation);
    return { ok: true, step: 'await_travel_date' };
  }

  // Extra Hi during flow → do NOT re-send (spam signal). Silently ignore.
  if (isGreeting(text) && (step === 'await_travel_date' || step === 'await_travelers')) {
    return { skipped: true, reason: 'greeting_ignored_during_flow' };
  }

  if (!text || isMediaPlaceholder(text)) {
    if (step === 'await_travel_date') {
      await maybeReask(conversation, step, QUESTIONS.reaskTravelDate);
    } else if (step === 'await_travelers') {
      await maybeReask(conversation, step, QUESTIONS.reaskTravelers);
    }
    return { ok: true, reasked: true };
  }

  if (step === 'await_travel_date') {
    await handleTravelDateAnswer(conversation, text);
    return { ok: true, step: 'await_travelers' };
  }

  if (step === 'await_travelers') {
    await handleTravelersAnswer(conversation, text);
    return { ok: true, step: 'completed' };
  }

  return { skipped: true, reason: 'unknown_step' };
}

async function pauseWhatsAppBot(conversationId) {
  if (!conversationId) return;
  await WhatsAppConversation.updateOne(
    { _id: conversationId, botStep: { $nin: ['completed'] } },
    { $set: { botStep: 'paused', botEnabled: false } }
  );
}

module.exports = {
  runWhatsAppQuestionnaireBot,
  syncBotAnswersToLead,
  pauseWhatsAppBot,
  parseTravelDate,
  parseTravelers,
  isGreeting,
  QUESTIONS,
};
