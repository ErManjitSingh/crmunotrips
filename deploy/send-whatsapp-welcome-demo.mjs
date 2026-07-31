/**
 * Send WhatsApp welcome demo to a phone (live app env).
 *   $env:VPS_PASSWORD='...'; node deploy/send-whatsapp-welcome-demo.mjs
 *   $env:VPS_PASSWORD='...'; $env:DEMO_PHONE='8219440351'; node deploy/send-whatsapp-welcome-demo.mjs
 */
import { Client } from 'ssh2';

const PASSWORD = process.env.VPS_PASSWORD;
const PHONE = String(process.env.DEMO_PHONE || '8219440351').replace(/\D/g, '').slice(-10);
const APP_ROOT = '/var/www/app-unotrips-crm';

if (!PASSWORD) {
  console.error('Set VPS_PASSWORD');
  process.exit(1);
}

const remote = `
set -e
cd ${APP_ROOT}/backend
node <<'NODE'
require('dotenv').config();
const WhatsAppConversation = require('./src/models/WhatsAppConversation');
const WhatsAppMessage = require('./src/models/WhatsAppMessage');
const mongoose = require('mongoose');
const { sendWhatsAppText, normalizePhone } = require('./src/services/whatsappCloudService');
const { QUESTIONS } = require('./src/services/whatsappQuestionnaireBot');

const PHONE = '${PHONE}';

(async () => {
  const uri = process.env.MONGO_URI || process.env.APP_MONGO_URI || 'mongodb://127.0.0.1:27017/app_unotrips_crm';
  await mongoose.connect(uri);
  const phone = normalizePhone(PHONE);
  console.log('Sending welcome demo to', phone);

  let conv = await WhatsAppConversation.findOne({ phone });
  if (!conv) {
    conv = await WhatsAppConversation.create({
      phone,
      waId: '91' + phone,
      profileName: 'Demo',
      botEnabled: true,
      botOptOut: false,
      botStep: 'idle',
      botAnswers: {},
      lastMessageAt: new Date(),
    });
  }

  await WhatsAppConversation.updateOne(
    { _id: conv._id },
    {
      $set: {
        botEnabled: true,
        botOptOut: false,
        botStep: 'await_destination',
        botSessionStartedAt: new Date(),
        botReaskCount: 0,
        botAnswers: {},
        botBlockedUntil: null,
        botCompletedAt: null,
      },
    }
  );

  const text = QUESTIONS.welcome;
  const data = await sendWhatsAppText({ toPhone: phone, text });
  const waMessageId = data?.messages?.[0]?.id;
  const now = new Date();
  await WhatsAppMessage.create({
    conversation: conv._id,
    fromPhone: phone,
    waMessageId,
    direction: 'outgoing',
    type: 'text',
    text,
    status: 'sent',
    timestamp: now,
  });
  await WhatsAppConversation.updateOne(
    { _id: conv._id },
    {
      $set: {
        lastMessageText: text,
        lastMessageAt: now,
        lastDirection: 'outgoing',
        botLastSentAt: now,
      },
    }
  );

  console.log('DEMO_WELCOME_SENT', JSON.stringify({ phone, waMessageId, step: 'await_destination' }));
  await mongoose.disconnect();
})().catch((err) => {
  console.error('DEMO_FAILED', err.message || err);
  process.exit(1);
});
NODE
`;

const c = new Client();
c.on('ready', () => {
  c.exec(remote, (_e, stream) => {
    stream.on('data', (d) => process.stdout.write(d));
    stream.stderr.on('data', (d) => process.stderr.write(d));
    stream.on('close', (code) => {
      c.end();
      process.exit(code || 0);
    });
  });
});
c.connect({
  host: process.env.VPS_HOST || '69.62.76.249',
  port: 22,
  username: 'root',
  password: PASSWORD,
});
