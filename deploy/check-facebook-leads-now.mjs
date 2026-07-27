/**
 * Check recent Facebook webhook activity + CRM leads on live.
 *   $env:VPS_PASSWORD='...'; node deploy/check-facebook-leads-now.mjs
 */
import { Client } from 'ssh2';

const PASSWORD = process.env.VPS_PASSWORD;
if (!PASSWORD) {
  console.error('Set VPS_PASSWORD');
  process.exit(1);
}

const remote = `
set +e
echo "== PM2 facebook last 80 =="
pm2 logs app-unotrips-api --lines 120 --nostream 2>/dev/null | grep -iE 'facebook|leadgen|ingest|phone|Graph' | tail -50

echo "== NGINX POST facebook last 30 =="
grep -E 'facebook/webhook|webhooks/facebook' /var/log/nginx/access.log 2>/dev/null | tail -30

echo "== MONGO recent facebook leads =="
cd /var/www/app-unotrips-crm/backend
node <<'NODE'
const fs = require('fs');
const mongoose = require('mongoose');
const env = fs.readFileSync('.env','utf8');
const line = env.split(/\\r?\\n/).find(l => l.startsWith('MONGO_URI='));
const uri = line ? line.slice('MONGO_URI='.length).trim() : '';
(async () => {
  await mongoose.connect(uri);
  const col = mongoose.connection.db.collection('leads');
  const recent = await col.find({
    \$or: [
      { source: 'facebook_ads' },
      { sourceLabel: /facebook/i },
      { channel: 'facebook' },
      { externalLeadSource: 'facebook_leadgen' },
    ],
    isDeleted: { \$ne: true },
  }).sort({ createdAt: -1 }).limit(8).project({
    leadId:1,name:1,phone:1,source:1,sourceLabel:1,channel:1,
    externalLeadId:1,createdAt:1,notes:1
  }).toArray();
  console.log(JSON.stringify(recent, null, 2));

  const lastHour = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const anyRecent = await col.find({ createdAt: { \$gte: lastHour }, isDeleted: { \$ne: true } })
    .sort({ createdAt: -1 }).limit(10)
    .project({ leadId:1,name:1,phone:1,source:1,sourceLabel:1,channel:1,createdAt:1 }).toArray();
  console.log('ANY_LEADS_LAST_2H', JSON.stringify(anyRecent, null, 2));
  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
NODE
echo CHECK_DONE
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
