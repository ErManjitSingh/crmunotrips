/**
 * Inspect current FB token permissions and page access.
 *   $env:VPS_PASSWORD='...'; node deploy/inspect-facebook-token-perms.mjs
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
const token = env.split(/\\r?\\n/).find(l => l.startsWith('FACEBOOK_PAGE_ACCESS_TOKEN=')).split('=').slice(1).join('=').trim();
const PAGE_ID = '928275203698122';
async function get(path) {
  const url = 'https://graph.facebook.com/v21.0' + path + (path.includes('?') ? '&' : '?') + 'access_token=' + encodeURIComponent(token);
  const res = await fetch(url);
  return res.json();
}
(async () => {
  console.log('PERMS', JSON.stringify(await get('/me/permissions'), null, 2));
  console.log('PAGE', JSON.stringify(await get('/' + PAGE_ID + '?fields=id,name'), null, 2));
  console.log('ACCOUNTS', JSON.stringify(await get('/me/accounts?fields=id,name&limit=50'), null, 2));
  console.log('SUBSCRIBED', JSON.stringify(await get('/' + PAGE_ID + '/subscribed_apps'), null, 2));
  console.log('LEADFORMS', JSON.stringify(await get('/' + PAGE_ID + '/leadgen_forms?limit=5'), null, 2));
})().catch(e => console.error(e));
NODE
curl -sS 'http://127.0.0.1:5001/api/facebook/webhook/debug?token=unotrips-fb-verify-2026' | python3 -c "import sys,json; j=json.load(sys.stdin); print('DEBUG', json.dumps(j.get('pageToken'), indent=2))"
`;

const c = new Client();
c.on('ready', () => {
  c.exec(remote, (_e, stream) => {
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
