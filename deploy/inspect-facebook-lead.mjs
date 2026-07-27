/**
 * Fetch a Facebook leadgen by id using VPS page token and print field_data.
 *   $env:VPS_PASSWORD='...'; $env:LEADGEN_ID='...'; node deploy/inspect-facebook-lead.mjs
 */
import { Client } from 'ssh2';

const PASSWORD = process.env.VPS_PASSWORD;
const LEADGEN_ID = (process.env.LEADGEN_ID || '').trim();
if (!PASSWORD || !LEADGEN_ID) {
  console.error('Set VPS_PASSWORD and LEADGEN_ID');
  process.exit(1);
}

const remote = `
cd /var/www/app-unotrips-crm/backend
node <<'NODE'
const fs = require('fs');
const id = '${LEADGEN_ID}';
const token = fs.readFileSync('.env','utf8').split(/\\r?\\n/).find(l => l.startsWith('FACEBOOK_PAGE_ACCESS_TOKEN=')).split('=').slice(1).join('=').trim();
(async () => {
  const url = 'https://graph.facebook.com/v21.0/' + id + '?fields=id,created_time,ad_id,form_id,field_data&access_token=' + encodeURIComponent(token);
  const data = await (await fetch(url)).json();
  console.log(JSON.stringify(data, null, 2));
})().catch(e => console.error(e));
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
