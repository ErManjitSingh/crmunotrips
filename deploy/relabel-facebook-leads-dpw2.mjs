/**
 * Relabel Facebook leads → sourceLabel DPW2 on app.unotrips.com DB.
 *   $env:VPS_PASSWORD='...'; node deploy/relabel-facebook-leads-dpw2.mjs
 */
import { Client } from 'ssh2';

const PASSWORD = process.env.VPS_PASSWORD;
const HOST = process.env.VPS_HOST || '69.62.76.249';
const APP = '/var/www/app-unotrips-crm';

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
      stream.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(`exit ${code}: ${out}`))));
    });
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

  await exec(
    conn,
    `cd ${APP}/backend && node -e "
const mongoose = require('mongoose');
require('dotenv').config();
(async () => {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGO_URI missing');
  await mongoose.connect(uri);
  const Lead = mongoose.connection.collection('leads');
  const filter = {
    isDeleted: { \\$ne: true },
    \\$or: [
      { source: 'facebook_ads' },
      { source: /facebook/i },
      { channel: 'facebook' },
      { sourceKey: 'facebook_ads' },
      { captureType: 'facebook_lead_ads' },
      { externalLeadSource: 'facebook_leadgen' },
    ],
  };
  const before = await Lead.countDocuments(filter);
  const res = await Lead.updateMany(filter, {
    \\$set: {
      source: 'facebook_ads',
      leadSource: 'facebook_ads',
      sourceLabel: 'DPW2',
      channel: 'facebook',
    },
  });
  console.log(JSON.stringify({ matched: before, modified: res.modifiedCount, ok: true }));
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
"`
  );

  conn.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
