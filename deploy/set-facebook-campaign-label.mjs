/**
 * Set FACEBOOK_DEFAULT_CAMPAIGN_LABEL and rename L-0177.
 *   $env:VPS_PASSWORD='...'; node deploy/set-facebook-campaign-label.mjs
 */
import { Client } from 'ssh2';

const PASSWORD = process.env.VPS_PASSWORD;
const LABEL = process.env.FACEBOOK_DEFAULT_CAMPAIGN_LABEL || 'UNO TRIPS Lead Form';
if (!PASSWORD) {
  console.error('Set VPS_PASSWORD');
  process.exit(1);
}

const safeLabel = LABEL.replace(/'/g, `'\\''`);

const remote = `
set -e
cd /var/www/app-unotrips-crm/backend
LABEL='${safeLabel}'
if grep -q '^FACEBOOK_DEFAULT_CAMPAIGN_LABEL=' .env; then
  sed -i "s|^FACEBOOK_DEFAULT_CAMPAIGN_LABEL=.*|FACEBOOK_DEFAULT_CAMPAIGN_LABEL=$LABEL|" .env
else
  echo "FACEBOOK_DEFAULT_CAMPAIGN_LABEL=$LABEL" >> .env
fi
grep '^FACEBOOK_DEFAULT_CAMPAIGN_LABEL=' .env
pm2 restart app-unotrips-api --update-env
sleep 2
export MONGO_URI='mongodb://127.0.0.1:27017/app_unotrips_crm'
export LABEL
node <<'NODE'
const mongoose = require('mongoose');
(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const label = process.env.LABEL || 'UNO TRIPS Lead Form';
  const r = await mongoose.connection.db.collection('leads').updateOne(
    { leadId: 'L-0177' },
    { $set: { name: label, sourceLabel: 'Facebook · ' + label } }
  );
  console.log('modified', r.modifiedCount);
  const d = await mongoose.connection.db.collection('leads').findOne(
    { leadId: 'L-0177' },
    { projection: { leadId: 1, name: 1, sourceLabel: 1 } }
  );
  console.log(JSON.stringify(d, null, 2));
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
NODE
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
