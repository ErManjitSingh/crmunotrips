/**
 * Convert FACEBOOK_PAGE_ACCESS_TOKEN (user) → Page token via /me/accounts
 * and restart API.
 *
 *   $env:VPS_PASSWORD='...'; node deploy/exchange-facebook-page-token.mjs
 */
import { Client } from 'ssh2';

const PASSWORD = process.env.VPS_PASSWORD;
const PAGE_ID = process.env.FACEBOOK_PAGE_ID || '928275203698122';
if (!PASSWORD) {
  console.error('Set VPS_PASSWORD');
  process.exit(1);
}

const remote = `
set -e
cd /var/www/app-unotrips-crm/backend
PAGE_ID='${PAGE_ID}'
node <<NODE
const fs = require('fs');
const PAGE_ID = process.env.PAGE_ID || '${PAGE_ID}';
const env = fs.readFileSync('.env','utf8');
const line = env.split(/\\r?\\n/).find(l => l.startsWith('FACEBOOK_PAGE_ACCESS_TOKEN='));
if (!line) { console.error('missing token'); process.exit(1); }
const token = line.slice('FACEBOOK_PAGE_ACCESS_TOKEN='.length).trim();
(async () => {
  const me = await (await fetch('https://graph.facebook.com/v21.0/me?fields=id,name&access_token=' + encodeURIComponent(token))).json();
  console.log('ME', JSON.stringify(me));
  if (me.error) process.exit(1);

  const accounts = await (await fetch('https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,tasks&limit=100&access_token=' + encodeURIComponent(token))).json();
  console.log('ACCOUNT_COUNT', (accounts.data || []).length);
  if (accounts.error) {
    console.log('ACCOUNTS_ERROR', JSON.stringify(accounts.error));
    process.exit(1);
  }
  const pages = accounts.data || [];
  pages.forEach(p => console.log('PAGE', p.id, p.name, 'tasks=' + (p.tasks||[]).join(',')));
  const page = pages.find(p => String(p.id) === String(PAGE_ID)) || pages[0];
  if (!page?.access_token) {
    console.log('NO_PAGE_TOKEN');
    process.exit(2);
  }
  console.log('SELECTED', page.id, page.name, 'len=' + page.access_token.length);

  const lines = env.split(/\\r?\\n/).filter(l => l && !l.startsWith('FACEBOOK_PAGE_ACCESS_TOKEN='));
  lines.push('FACEBOOK_PAGE_ACCESS_TOKEN=' + page.access_token);
  fs.writeFileSync('.env', lines.join('\\n') + '\\n');

  const check = await (await fetch('https://graph.facebook.com/v21.0/me?fields=id,name&access_token=' + encodeURIComponent(page.access_token))).json();
  console.log('PAGE_ME', JSON.stringify(check));
  console.log('PAGE_TOKEN_SAVED');
})().catch(e => { console.error(e); process.exit(1); });
NODE

pm2 restart app-unotrips-api --update-env
sleep 2
curl -sS 'http://127.0.0.1:5001/api/facebook/webhook/debug?token=unotrips-fb-verify-2026' | python3 -c "import sys,json; j=json.load(sys.stdin); print(json.dumps({'configured': j.get('configured'), 'pageToken': j.get('pageToken'), 'hasAppSecret': j.get('hasAppSecret')}, indent=2))"
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
