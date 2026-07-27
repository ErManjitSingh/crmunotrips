/**
 * Restart API and verify saved Page token.
 *   $env:VPS_PASSWORD='...'; node deploy/verify-facebook-page-token.mjs
 */
import { Client } from 'ssh2';

const PASSWORD = process.env.VPS_PASSWORD;
if (!PASSWORD) {
  console.error('Set VPS_PASSWORD');
  process.exit(1);
}

const remote = `
set -e
pm2 restart app-unotrips-api --update-env
sleep 2
cd /var/www/app-unotrips-crm/backend
node <<'NODE'
const fs = require('fs');
const token = fs.readFileSync('.env','utf8').split(/\\r?\\n/).find(l => l.startsWith('FACEBOOK_PAGE_ACCESS_TOKEN=')).split('=').slice(1).join('=').trim();
(async () => {
  const me = await (await fetch('https://graph.facebook.com/v21.0/me?fields=id,name&access_token=' + encodeURIComponent(token))).json();
  console.log('PAGE_ME', JSON.stringify(me));
  const sub = await (await fetch('https://graph.facebook.com/v21.0/928275203698122/subscribed_apps?access_token=' + encodeURIComponent(token))).json();
  console.log('SUBSCRIBED', JSON.stringify(sub));
})();
NODE
curl -sS 'http://127.0.0.1:5001/api/facebook/webhook/debug?token=unotrips-fb-verify-2026'
echo
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
