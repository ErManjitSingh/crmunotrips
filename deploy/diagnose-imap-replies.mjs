import { Client } from 'ssh2';

const PASSWORD = process.env.VPS_PASSWORD;
const HOST = process.env.VPS_HOST || '69.62.76.249';
const USER = process.env.VPS_USER || 'root';
const APP_ROOT = '/var/www/testing-unotrips-crm';

if (!PASSWORD) {
  console.error('Set VPS_PASSWORD');
  process.exit(1);
}

function exec(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, { pty: true }, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      stream.on('data', (d) => {
        process.stdout.write(d);
        out += d;
      });
      stream.stderr.on('data', (d) => process.stderr.write(d));
      stream.on('close', (code) => (code !== 0 ? reject(new Error(`exit ${code}`)) : resolve(out)));
    });
  });
}

const script = `set -e
cd ${APP_ROOT}/backend
echo "==> IMAP env"
grep -E '^(IMAP|SMTP)_(HOST|PORT|USER)=' .env || true
echo ""
echo "==> PM2 email inbox logs (last 30 lines)"
pm2 logs testing-unotrips-api --lines 30 --nostream 2>/dev/null | grep -iE 'EmailInbox|IMAP|email' || echo "(no inbox logs)"
echo ""
echo "==> Mongo EmailReply count"
node -e "
require('dotenv').config();
const mongoose = require('mongoose');
(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const EmailReply = require('./src/models/EmailReply');
  const EmailLog = require('./src/models/EmailLog');
  const Lead = require('./src/models/Lead');
  const replies = await EmailReply.countDocuments();
  const sent = await EmailLog.countDocuments({ status: 'sent' });
  const recentReplies = await EmailReply.find().sort({ receivedAt: -1 }).limit(3).lean();
  const recentSent = await EmailLog.find({ status: 'sent' }).sort({ sentAt: -1 }).limit(3).select('subject to messageId leadId sentAt').lean();
  console.log('EmailReply total:', replies);
  console.log('EmailLog sent total:', sent);
  console.log('Recent replies:', JSON.stringify(recentReplies, null, 2));
  console.log('Recent sent:', JSON.stringify(recentSent, null, 2));
  const leadsWithEmail = await Lead.countDocuments({ email: { $exists: true, $ne: '' }, isDeleted: { $ne: true } });
  console.log('Leads with email:', leadsWithEmail);
  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
"
echo ""
echo "==> IMAP connect + inbox scan"
node -e "
require('dotenv').config();
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
(async () => {
  const client = new ImapFlow({
    host: process.env.IMAP_HOST || process.env.SMTP_HOST,
    port: Number(process.env.IMAP_PORT || 993),
    secure: process.env.IMAP_SECURE !== 'false',
    auth: {
      user: process.env.IMAP_USER || process.env.SMTP_USER,
      pass: process.env.IMAP_PASS || process.env.SMTP_PASS,
    },
    logger: false,
  });
  await client.connect();
  console.log('IMAP connect: OK');
  const lock = await client.getMailboxLock('INBOX');
  try {
    const status = await client.status('INBOX', { messages: true, unseen: true });
    console.log('INBOX messages:', status.messages, 'unseen:', status.unseen);
    const since = new Date();
    since.setDate(since.getDate() - 14);
    const uids = await client.search({ since }, { uid: true });
    console.log('UIDs since 14d:', Array.isArray(uids) ? uids.length : uids);
    const allUids = await client.search({ all: true }, { uid: true });
    console.log('All UIDs:', Array.isArray(allUids) ? allUids.length : allUids);
    const recent = (Array.isArray(allUids) ? allUids : []).slice(-5);
    for await (const msg of client.fetch(recent, { envelope: true, source: true, uid: true })) {
      const parsed = await simpleParser(msg.source);
      console.log('---');
      console.log('UID:', msg.uid);
      console.log('From:', parsed.from?.text);
      console.log('Subject:', parsed.subject);
      console.log('Message-ID:', msg.envelope?.messageId);
      console.log('In-Reply-To:', parsed.inReplyTo);
      console.log('Snippet:', (parsed.text || '').slice(0, 80));
    }
  } finally {
    lock.release();
  }
  await client.logout();
})().catch(e => { console.error('IMAP FAILED:', e.message); process.exit(1); });
"
echo ""
echo "==> Manual pollInboxOnce"
node -e "
require('dotenv').config();
const mongoose = require('mongoose');
(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const { pollInboxOnce } = require('./src/services/emailInboxService');
  const before = await require('./src/models/EmailReply').countDocuments();
  await pollInboxOnce();
  const after = await require('./src/models/EmailReply').countDocuments();
  console.log('Replies before:', before, 'after:', after, 'new:', after - before);
  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
"
echo "DIAGNOSE_IMAP_OK"
`;

const conn = new Client();
conn
  .on('ready', async () => {
    try {
      await exec(conn, script);
    } finally {
      conn.end();
    }
  })
  .on('error', (e) => {
    console.error(e);
    process.exit(1);
  })
  .connect({ host: HOST, port: 22, username: USER, password: PASSWORD });
