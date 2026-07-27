/**
 * Reprocess a Facebook leadgen id through live CRM ingest.
 *   $env:VPS_PASSWORD='...'; $env:LEADGEN_ID='...'; node deploy/reprocess-facebook-lead.mjs
 */
import { Client } from 'ssh2';

const PASSWORD = process.env.VPS_PASSWORD;
const LEADGEN_ID = (process.env.LEADGEN_ID || '').trim();
const PAGE_ID = process.env.FACEBOOK_PAGE_ID || '928275203698122';
const FORM_ID = process.env.FACEBOOK_FORM_ID || '1527550791622492';

if (!PASSWORD || !LEADGEN_ID) {
  console.error('Set VPS_PASSWORD and LEADGEN_ID');
  process.exit(1);
}

const remote = `
cd /var/www/app-unotrips-crm/backend
node <<'NODE'
const { ingestFacebookLeadgen } = require('./src/services/facebookLeadWebhookService');
const { connectDB } = require('./src/config/db');

(async () => {
  await connectDB();
  const result = await ingestFacebookLeadgen({
    leadgenId: '${LEADGEN_ID}',
    pageId: '${PAGE_ID}',
    formId: '${FORM_ID}',
    adId: '',
    adgroupId: '',
    createdTime: Math.floor(Date.now() / 1000),
  });
  console.log(JSON.stringify({
    ok: true,
    duplicate: result.duplicate,
    phoneFallback: result.phoneFallback,
    leadId: result.lead?.leadId || result.lead?._id,
    name: result.lead?.name,
    phone: result.lead?.phone,
  }, null, 2));
  process.exit(0);
})().catch((err) => {
  console.error('REPROCESS_FAIL', err.message);
  process.exit(1);
});
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
