/**
 * Update existing Facebook test lead L-0177 name/sourceLabel using form/campaign meta.
 *   $env:VPS_PASSWORD='...'; node deploy/relabel-facebook-test-lead.mjs
 */
import { Client } from 'ssh2';

const PASSWORD = process.env.VPS_PASSWORD;
if (!PASSWORD) {
  console.error('Set VPS_PASSWORD');
  process.exit(1);
}

const remote = `
set -e
cd /var/www/app-unotrips-crm/backend
export MONGO_URI='mongodb://127.0.0.1:27017/app_unotrips_crm'
node <<'NODE'
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/app_unotrips_crm';
const mongoose = require('mongoose');
const fs = require('fs');
const token = fs.readFileSync('.env','utf8').split(/\\r?\\n/).find(l => l.startsWith('FACEBOOK_PAGE_ACCESS_TOKEN=')).split('=').slice(1).join('=').trim();
const FORM_ID = '1527550791622492';

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  let formName = '';
  try {
    const form = await (await fetch('https://graph.facebook.com/v21.0/' + FORM_ID + '?fields=name&access_token=' + encodeURIComponent(token))).json();
    formName = form.name || '';
    console.log('FORM', JSON.stringify(form));
  } catch (e) {
    console.log('FORM_FETCH_FAIL', e.message);
  }

  const label = formName ? ('Facebook · ' + formName) : 'Facebook Lead';
  const name = formName || 'Facebook Lead';

  const res = await mongoose.connection.db.collection('leads').findOneAndUpdate(
    { leadId: 'L-0177' },
    {
      $set: {
        name,
        sourceLabel: label,
        notes: 'FB Form: ' + (formName || FORM_ID) + '\\nFB Form ID: ' + FORM_ID + '\\nNOTE: Meta test lead — dummy full_name replaced with form/campaign label.',
      },
    },
    { returnDocument: 'after' }
  );
  console.log('UPDATED', JSON.stringify(res?.value || res, null, 2));
  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
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
