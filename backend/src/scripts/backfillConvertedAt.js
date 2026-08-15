/**
 * Stamp convertedAt on converted leads (from Booking.createdAt, else updatedAt).
 * Run from backend folder with dotenv / production .env.
 */
require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/app_unotrips_crm';
  await mongoose.connect(uri);
  const Lead = require('../models/Lead');
  const Booking = require('../models/Booking');

  const missing = await Lead.find({
    status: 'converted',
    $or: [{ convertedAt: null }, { convertedAt: { $exists: false } }],
  })
    .select('_id updatedAt')
    .lean();

  let stamped = 0;
  for (const row of missing) {
    const booking = await Booking.findOne({ lead: row._id }).select('createdAt').sort({ createdAt: 1 }).lean();
    const convertedAt = booking?.createdAt || row.updatedAt || new Date();
    await Lead.updateOne({ _id: row._id }, { $set: { convertedAt } });
    stamped += 1;
  }

  console.log(JSON.stringify({ missing: missing.length, stamped }));
  await mongoose.disconnect();
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
