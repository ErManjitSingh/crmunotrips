import { Client } from 'ssh2';

const PASSWORD = process.env.VPS_PASSWORD;
if (!PASSWORD) {
  console.error('Set VPS_PASSWORD');
  process.exit(1);
}

const remote = `cd /var/www/testing-unotrips-crm/backend && node <<'NODE'
require('dotenv').config();
const mongoose = require('mongoose');
(async () => {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DATABASE_URL;
  if (!uri) {
    console.error('No Mongo URI in env. Keys:', Object.keys(process.env).filter((k) => /MONGO|DB|DATABASE/i.test(k)));
    process.exit(1);
  }
  await mongoose.connect(uri);
  const Lead = mongoose.connection.collection('leads');
  const total = await Lead.countDocuments();
  const active = await Lead.countDocuments({ isDeleted: { $ne: true } });
  const deleted = await Lead.countDocuments({ isDeleted: true });
  const withId = await Lead.countDocuments({ leadId: { $exists: true, $ne: null } });
  const ids = await Lead.find(
    { leadId: { $exists: true, $ne: null } },
    { projection: { leadId: 1, isDeleted: 1, name: 1, phone: 1, createdAt: 1 } }
  )
    .sort({ leadId: 1 })
    .toArray();
  const nums = ids
    .map((x) => Number(String(x.leadId).replace(/\\D/g, '')))
    .filter((n) => !Number.isNaN(n));
  const maxNum = nums.length ? Math.max(...nums) : 0;
  console.log(JSON.stringify({ total, active, deleted, withId, maxNum, nextByCount: total + 1, ids }, null, 2));
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
NODE`;

const conn = new Client();
conn
  .on('ready', () => {
    conn.exec(remote, { pty: true }, (err, stream) => {
      if (err) {
        console.error(err);
        process.exit(1);
      }
      stream.on('data', (d) => process.stdout.write(d));
      stream.stderr.on('data', (d) => process.stderr.write(d));
      stream.on('close', (code) => {
        conn.end();
        process.exit(code || 0);
      });
    });
  })
  .on('error', (e) => {
    console.error(e);
    process.exit(1);
  })
  .connect({ host: '69.62.76.249', port: 22, username: 'root', password: PASSWORD });
