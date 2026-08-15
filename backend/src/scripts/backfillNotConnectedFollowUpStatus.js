/**
 * One-shot: leads stuck on status=new after Not connected follow-up → follow_up.
 * Run on VPS from backend folder with dotenv.
 */
require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/app_unotrips_crm';
  await mongoose.connect(uri);
  const Lead = require('../models/Lead');
  const FollowUp = require('../models/FollowUp');

  const notConnectedKeys = [
    'not_answering',
    'switched_off',
    'switch_off',
    'not_reachable',
    'speaking_to_someone_else',
    'no_answer',
  ];
  const reasonRegex = new RegExp(notConnectedKeys.join('|'), 'i');

  // 1) status=new + statusReason looks like not-connected option
  const byReason = await Lead.updateMany(
    { status: 'new', statusReason: { $regex: reasonRegex } },
    { $set: { status: 'follow_up' } }
  );

  // 2) status=new + has call_not_picked follow-up (even if reason empty)
  const ids = await FollowUp.distinct('lead', { category: 'call_not_picked' });
  const byFu = await Lead.updateMany(
    { _id: { $in: ids }, status: 'new' },
    { $set: { status: 'follow_up' } }
  );

  // Stamp statusReason from latest not-connected FU when missing
  const stillMissingReason = await Lead.find({
    _id: { $in: ids },
    status: 'follow_up',
    $or: [{ statusReason: null }, { statusReason: '' }, { statusReason: { $exists: false } }],
  })
    .select('_id')
    .lean();

  let stamped = 0;
  for (const row of stillMissingReason) {
    const fu = await FollowUp.findOne({ lead: row._id, category: 'call_not_picked' })
      .sort({ createdAt: -1 })
      .select('outcome')
      .lean();
    if (fu?.outcome) {
      await Lead.updateOne({ _id: row._id }, { $set: { statusReason: String(fu.outcome) } });
      stamped += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        byReasonMatched: byReason.matchedCount ?? byReason.n,
        byReasonModified: byReason.modifiedCount ?? byReason.nModified,
        byFuMatched: byFu.matchedCount ?? byFu.n,
        byFuModified: byFu.modifiedCount ?? byFu.nModified,
        stampedReason: stamped,
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
