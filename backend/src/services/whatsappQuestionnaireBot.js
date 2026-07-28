const WhatsAppConversation = require('../models/WhatsAppConversation');
const WhatsAppMessage = require('../models/WhatsAppMessage');
const Lead = require('../models/Lead');

const QUESTIONS = {
  travelDate:
    'Namaste! Uno Trips me aapka swagat hai.\n\nKab jana hai ghumne?\n(jaise: 15/08/2026 ya 15 Aug 2026)',
  travelers:
    'Bahut accha!\n\nKitne travelers hain?\n(sirf number likhein, jaise: 4)',
  done:
    'Shukriya! Aapki details save ho gayi hain.\n\nHamari team jald hi aapse contact karegi.',
  reaskTravelDate:
    'Date samajh nahi aayi. Please dobara likhein (jaise: 15/08/2026 ya 15 Aug 2026).',
  reaskTravelers:
    'Please sirf number likhein — kitne travelers hain? (jaise: 2, 4, 6)',
};

function isMediaPlaceholder(text = '') {
  return /^\[(Image|Document|Audio|Video|Sticker)\]$/i.test(String(text).trim());
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

function botSummary(answers = {}) {
  const parts = [];
  if (answers.travelDateRaw || answers.travelDate) {
    parts.push(`Travel date: ${answers.travelDateRaw || answers.travelDate}`);
  }
  if (answers.travelers) {
    parts.push(`Travelers: ${answers.travelers}`);
  }
  return parts.join('\n');
}

async function sendAndStoreBotReply(conversation, text) {
  const { sendWhatsAppText } = require('./whatsappCloudService');
  const phone = conversation.phone;
  let waMessageId;
  try {
    const data = await sendWhatsAppText({ toPhone: phone, text });
    waMessageId = data?.messages?.[0]?.id;
  } catch (err) {
    console.error('[whatsappBot] send failed', err.message);
    throw err;
  }

  const now = new Date();
  await WhatsAppMessage.create({
    conversation: conversation._id,
    lead: conversation.lead || undefined,
    waMessageId,
    fromPhone: phone,
    direction: 'outgoing',
    type: 'text',
    text,
    status: 'sent',
    timestamp: now,
  });

  conversation.lastMessageText = text;
  conversation.lastMessageAt = now;
  conversation.lastDirection = 'outgoing';
  await conversation.save();
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

  const summary = botSummary(answers);
  if (summary) {
    const lead = await Lead.findById(conversation.lead).select('notes specialRequirements').lean();
    if (lead) {
      const marker = '[WhatsApp auto details]';
      const block = `${marker}\n${summary}`;
      const notes = String(lead.notes || '');
      if (!notes.includes(marker)) {
        update.notes = notes ? `${notes}\n\n${block}` : block;
      }
      if (!answers.travelDate && answers.travelDateRaw) {
        const sr = String(lead.specialRequirements || '');
        if (!sr.includes(answers.travelDateRaw)) {
          update.specialRequirements = sr
            ? `${sr}; Travel date: ${answers.travelDateRaw}`
            : `Travel date: ${answers.travelDateRaw}`;
        }
      }
    }
  }

  if (!Object.keys(update).length) return null;
  return Lead.findByIdAndUpdate(conversation.lead, { $set: update }, { new: true });
}

async function askTravelDate(conversation) {
  const claimed = await WhatsAppConversation.findOneAndUpdate(
    {
      _id: conversation._id,
      botEnabled: { $ne: false },
      botStep: { $in: [null, undefined, 'idle'] },
    },
    { $set: { botStep: 'await_travel_date' } },
    { new: true }
  );
  if (!claimed) return;
  await sendAndStoreBotReply(claimed, QUESTIONS.travelDate);
}

async function handleTravelDateAnswer(conversation, text) {
  const travelDate = parseTravelDate(text);
  // Accept free-text dates even if unparsed, so flow continues
  if (!text || isMediaPlaceholder(text)) {
    await sendAndStoreBotReply(conversation, QUESTIONS.reaskTravelDate);
    return;
  }

  const claimed = await WhatsAppConversation.findOneAndUpdate(
    {
      _id: conversation._id,
      botEnabled: { $ne: false },
      botStep: 'await_travel_date',
    },
    {
      $set: {
        botStep: 'await_travelers',
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
    await sendAndStoreBotReply(conversation, QUESTIONS.reaskTravelers);
    return;
  }

  const claimed = await WhatsAppConversation.findOneAndUpdate(
    {
      _id: conversation._id,
      botEnabled: { $ne: false },
      botStep: 'await_travelers',
    },
    {
      $set: {
        botStep: 'completed',
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
  if (conversation.botEnabled === false) return { skipped: true, reason: 'disabled' };

  const step = conversation.botStep || 'idle';
  if (step === 'completed' || step === 'paused') {
    return { skipped: true, reason: step };
  }

  const text = String(inboundText || '').trim();

  if (step === 'idle') {
    await askTravelDate(conversation);
    return { ok: true, step: 'await_travel_date' };
  }

  if (!text || isMediaPlaceholder(text)) {
    if (step === 'await_travel_date') {
      await sendAndStoreBotReply(conversation, QUESTIONS.reaskTravelDate);
    } else if (step === 'await_travelers') {
      await sendAndStoreBotReply(conversation, QUESTIONS.reaskTravelers);
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
  QUESTIONS,
};
