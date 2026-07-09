require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const EmailReply = require('./src/models/EmailReply');
  const EmailLog = require('./src/models/EmailLog');
  const Lead = require('./src/models/Lead');

  const replies = await EmailReply.find().sort({ receivedAt: -1 }).lean();
  console.log('Replies:', replies.length);
  for (const r of replies) {
    const lead = r.leadId ? await Lead.findById(r.leadId).select('name email assignedTo branchId').lean() : null;
    console.log(JSON.stringify({
      id: r._id,
      from: r.fromEmail,
      subject: r.subject,
      lead: lead?.name,
      leadEmail: lead?.email,
      branchId: r.branchId,
      leadBranchId: lead?.branchId,
      assignedTo: lead?.assignedTo,
      receivedAt: r.receivedAt,
    }, null, 2));
  }

  const logs = await EmailLog.find({ status: 'sent' }).sort({ sentAt: -1 }).limit(5).select('subject to messageId leadId sentAt').lean();
  console.log('Recent sent logs:', JSON.stringify(logs, null, 2));

  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
