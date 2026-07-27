/**
 * Deep-check FACEBOOK_PAGE_ACCESS_TOKEN on VPS via Node (no shell mangling).
 *   $env:VPS_PASSWORD='...'; node deploy/probe-facebook-token.mjs
 */
import { Client } from 'ssh2';

const PASSWORD = process.env.VPS_PASSWORD;
if (!PASSWORD) {
  console.error('Set VPS_PASSWORD');
  process.exit(1);
}

const remote = `
cd /var/www/app-unotrips-crm/backend
node <<'NODE'
const fs = require('fs');
const env = fs.readFileSync('.env','utf8');
const line = env.split(/\\r?\\n/).find(l => l.startsWith('FACEBOOK_PAGE_ACCESS_TOKEN='));
if (!line) { console.log(JSON.stringify({error:'missing'})); process.exit(0); }
const token = line.slice('FACEBOOK_PAGE_ACCESS_TOKEN='.length);
const nonAscii = [...token].filter(c => c.charCodeAt(0) > 127).map(c => c.charCodeAt(0));
console.log(JSON.stringify({
  len: token.length,
  prefix: token.slice(0,12),
  suffix: token.slice(-12),
  nonAsciiCount: nonAscii.length,
  nonAsciiSample: nonAscii.slice(0,10),
}, null, 2));
(async () => {
  const me = await fetch('https://graph.facebook.com/v21.0/me?access_token=' + encodeURIComponent(token));
  const meJson = await me.json();
  console.log('ME', JSON.stringify(meJson));
  const dbg = await fetch('https://graph.facebook.com/v21.0/debug_token?input_token=' + encodeURIComponent(token) + '&access_token=' + encodeURIComponent(token));
  const dbgJson = await dbg.json();
  console.log('DEBUG_TOKEN', JSON.stringify(dbgJson));
  const page = await fetch('https://graph.facebook.com/v21.0/928275203698122?fields=id,name,access_token&access_token=' + encodeURIComponent(token));
  console.log('PAGE', JSON.stringify(await page.json()));
})().catch(e => console.error(e));
NODE
`;

const c = new Client();
c.on('ready', () => {
  c.exec(remote, (err, stream) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    stream.on('data', (d) => process.stdout.write(d));
    stream.stderr.on('data', (d) => process.stderr.write(d));
    stream.on('close', () => c.end());
  });
});
c.connect({
  host: process.env.VPS_HOST || '69.62.76.249',
  port: 22,
  username: 'root',
  password: PASSWORD,
});
