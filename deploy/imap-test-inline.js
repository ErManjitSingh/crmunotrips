require('dotenv').config();
const mongoose = require('mongoose');
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');

(async () => {
  console.log('IMAP_HOST', process.env.IMAP_HOST);
  console.log('IMAP_USER', process.env.IMAP_USER);
  console.log('IMAP_PASS set', !!process.env.IMAP_PASS);

  const client = new ImapFlow({
    host: process.env.IMAP_HOST || 'imap.hostinger.com',
    port: Number(process.env.IMAP_PORT || 993),
    secure: true,
    auth: {
      user: process.env.IMAP_USER || process.env.SMTP_USER,
      pass: process.env.IMAP_PASS || process.env.SMTP_PASS,
    },
    logger: false,
    socketTimeout: 120000,
    greetingTimeout: 30000,
    tls: {
      servername: process.env.IMAP_HOST || 'imap.hostinger.com',
      minVersion: 'TLSv1.2',
    },
  });

  await client.connect();
  console.log('IMAP connect: OK');

  const lock = await client.getMailboxLock('INBOX');
  try {
    const status = await client.status('INBOX', { messages: true, unseen: true });
    console.log('INBOX status:', status);

    const since = new Date();
    since.setDate(since.getDate() - 30);
    let uids = await client.search({ since });
    console.log('UIDs (30d):', uids?.length ?? uids);

    if (!uids?.length) {
      uids = await client.search({ all: true });
      console.log('UIDs (all):', uids?.length ?? uids);
    }

    const recent = (uids || []).slice(-5);
    for await (const msg of client.fetch(recent, { envelope: true, source: true, uid: true })) {
      const parsed = await simpleParser(msg.source);
      console.log('--- message ---');
      console.log('uid:', msg.uid);
      console.log('from:', parsed.from?.text);
      console.log('subject:', parsed.subject);
      console.log('messageId:', msg.envelope?.messageId);
      console.log('inReplyTo:', parsed.inReplyTo);
    }
  } finally {
    lock.release();
  }

  await client.logout();

  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  const EmailReply = require('./src/models/EmailReply');
  const EmailLog = require('./src/models/EmailLog');
  console.log('EmailReply count:', await EmailReply.countDocuments());
  console.log('EmailLog sent:', await EmailLog.countDocuments({ status: 'sent' }));

  const { pollInboxOnce } = require('./src/services/emailInboxService');
  const before = await EmailReply.countDocuments();
  await pollInboxOnce();
  const after = await EmailReply.countDocuments();
  console.log('Poll result: before', before, 'after', after, 'new', after - before);

  await mongoose.disconnect();
})().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
