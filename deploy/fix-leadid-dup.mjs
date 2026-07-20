/**
 * Patch Lead.leadId generation on VPS and verify public lead ingest.
 *   $env:VPS_PASSWORD='...'; node deploy/fix-leadid-dup.mjs
 */
import { Client } from 'ssh2';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PASSWORD = process.env.VPS_PASSWORD;
const HOST = process.env.VPS_HOST || '69.62.76.249';
const LOCAL_LEAD = path.resolve(__dirname, '../backend/src/models/Lead.js');
const REMOTE_LEAD = '/var/www/testing-unotrips-crm/backend/src/models/Lead.js';

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
      stream.stderr?.on('data', (d) => process.stderr.write(d));
      stream.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(`exit ${code}: ${out.slice(-500)}`))));
    });
  });
}

function upload(sftp, local, remote) {
  return new Promise((resolve, reject) => {
    sftp.fastPut(local, remote, (err) => (err ? reject(err) : resolve()));
  });
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve).on('error', reject).connect({
      host: HOST,
      port: 22,
      username: 'root',
      password: PASSWORD,
    });
  });
  console.log('SSH connected.\n');

  await exec(
    conn,
    `cd /var/www/testing-unotrips-crm/backend && node <<'NODE'
require('dotenv').config();
const mongoose = require('mongoose');
(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const Lead = mongoose.connection.collection('leads');
  const total = await Lead.countDocuments();
  const ids = await Lead.find(
    { leadId: { $exists: true, $ne: null } },
    { projection: { leadId: 1, isDeleted: 1, name: 1, phone: 1 } }
  ).sort({ leadId: 1 }).toArray();
  const nums = ids.map((x) => Number(String(x.leadId).replace(/\\D/g, ''))).filter((n) => !Number.isNaN(n));
  const maxNum = nums.length ? Math.max(...nums) : 0;
  console.log(JSON.stringify({ total, maxNum, nextByCount: total + 1, nextByMax: maxNum + 1, ids }, null, 2));
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
NODE`
  );

  const sftp = await new Promise((resolve, reject) => {
    conn.sftp((err, s) => (err ? reject(err) : resolve(s)));
  });
  await upload(sftp, LOCAL_LEAD, REMOTE_LEAD);
  console.log('\nUploaded Lead.js\n');

  await exec(conn, 'pm2 restart testing-unotrips-api --update-env && sleep 3 && curl -sf http://127.0.0.1:5000/api/health');
  console.log('\n');

  await exec(
    conn,
    `php -r 'require "/var/www/unotrips-meta/assam/crm_lead_push.php"; var_export(uno_crm_push_lead(["name"=>"LeadId Fix Test","phone"=>"9111998877","destination"=>"Assam","source"=>"Assam Landing Page","captureType"=>"form","email"=>"leadid-fix@test.com"])); echo PHP_EOL;'`
  );

  console.log('\n');
  await exec(
    conn,
    `curl -sk -X POST "https://127.0.0.1/meta/assam/send_lead.php" -H "Host: unotrips.com" -H "Content-Type: application/json" -d '{"name":"Form After Fix","phone":"9000099988","email":"formfix@test.com","destination":"Assam","source":"Assam Landing Page"}'; echo`
  );

  conn.end();
  console.log('\nDONE');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
