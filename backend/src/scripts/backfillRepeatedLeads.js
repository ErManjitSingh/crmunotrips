/**
 * Mark later leads that share a phone with an earlier lead as isRepeatCustomer.
 * Run: node src/scripts/backfillRepeatedLeads.js
 */
require('dotenv').config();
const mongoose = require('mongoose');

function phoneTail(raw = '') {
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  return digits.length ? digits : '';
}

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGO_URI missing');
  await mongoose.connect(uri);

  const Lead = mongoose.connection.collection('leads');
  const rows = await Lead.find(
    { isDeleted: { $ne: true }, phone: { $exists: true, $ne: '' } },
    { projection: { phone: 1, alternatePhone: 1, createdAt: 1, isRepeatCustomer: 1, leadId: 1, name: 1 } }
  )
    .sort({ createdAt: 1 })
    .toArray();

  /** @type {Map<string, { firstId: any, laterIds: any[] }>} */
  const byPhone = new Map();

  for (const row of rows) {
    const phones = [...new Set([phoneTail(row.phone), phoneTail(row.alternatePhone)].filter((p) => p.length === 10))];
    for (const phone of phones) {
      let bucket = byPhone.get(phone);
      if (!bucket) {
        bucket = { firstId: row._id, laterIds: [] };
        byPhone.set(phone, bucket);
        continue;
      }
      if (String(bucket.firstId) === String(row._id)) continue;
      bucket.laterIds.push(row._id);
    }
  }

  const toMark = [...new Set(
    [...byPhone.values()].flatMap((b) => b.laterIds.map((id) => String(id)))
  )].map((id) => new mongoose.Types.ObjectId(id));

  const dupPhoneCount = [...byPhone.values()].filter((b) => b.laterIds.length > 0).length;

  let modified = 0;
  if (toMark.length) {
    const res = await Lead.updateMany(
      { _id: { $in: toMark }, isRepeatCustomer: { $ne: true } },
      { $set: { isRepeatCustomer: true } }
    );
    modified = res.modifiedCount;
  }

  console.log(
    JSON.stringify(
      {
        scanned: rows.length,
        duplicatePhones: dupPhoneCount,
        leadsToMark: toMark.length,
        modified,
      },
      null,
      2
    )
  );

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
