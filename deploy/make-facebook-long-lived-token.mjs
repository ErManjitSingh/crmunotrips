/**
 * Exchange short-lived User token → long-lived User → never-expiring Page token.
 * Saves to live VPS backend .env and restarts API.
 *
 *   $env:VPS_PASSWORD='...'
 *   $env:FACEBOOK_USER_TOKEN='EAAx...'
 *   node deploy/make-facebook-long-lived-token.mjs
 */
import { Client } from 'ssh2';

const PASSWORD = process.env.VPS_PASSWORD;
const USER_TOKEN = (process.env.FACEBOOK_USER_TOKEN || '').trim();
const PAGE_ID = process.env.FACEBOOK_PAGE_ID || '928275203698122';

if (!PASSWORD) {
  console.error('Set VPS_PASSWORD');
  process.exit(1);
}
if (!USER_TOKEN) {
  console.error('Set FACEBOOK_USER_TOKEN');
  process.exit(1);
}

const remote = `
set -e
cd /var/www/app-unotrips-crm/backend
cat > /tmp/fb_user_token.txt <<'TOK'
${USER_TOKEN}
TOK
PAGE_ID='${PAGE_ID}'

node <<'NODE'
const fs = require('fs');
const PAGE_ID = process.env.PAGE_ID || '${PAGE_ID}';
const userToken = fs.readFileSync('/tmp/fb_user_token.txt','utf8').trim();

function envGet(key) {
  const line = fs.readFileSync('.env','utf8').split(/\\r?\\n/).find(l => l.startsWith(key + '='));
  return line ? line.slice(key.length + 1).trim() : '';
}
function envSet(key, value) {
  const lines = fs.readFileSync('.env','utf8').split(/\\r?\\n/).filter(l => l && !l.startsWith(key + '='));
  lines.push(key + '=' + value);
  fs.writeFileSync('.env', lines.join('\\n') + '\\n');
}

(async () => {
  const appId = envGet('FACEBOOK_APP_ID');
  const appSecret = envGet('FACEBOOK_APP_SECRET');
  if (!appId || !appSecret) {
    console.error('FACEBOOK_APP_ID / FACEBOOK_APP_SECRET missing on VPS');
    process.exit(1);
  }

  console.log('1) Exchange → long-lived user token...');
  const exUrl = new URL('https://graph.facebook.com/v21.0/oauth/access_token');
  exUrl.searchParams.set('grant_type', 'fb_exchange_token');
  exUrl.searchParams.set('client_id', appId);
  exUrl.searchParams.set('client_secret', appSecret);
  exUrl.searchParams.set('fb_exchange_token', userToken);
  const ex = await (await fetch(exUrl)).json();
  if (!ex.access_token) {
    console.error('EXCHANGE_FAILED', JSON.stringify(ex));
    process.exit(1);
  }
  const longUser = ex.access_token;
  console.log('LONG_USER_OK expires_in=' + (ex.expires_in || 'n/a') + 's len=' + longUser.length);

  console.log('2) Page token for', PAGE_ID);
  const page = await (await fetch(
    'https://graph.facebook.com/v21.0/' + PAGE_ID +
    '?fields=id,name,access_token&access_token=' + encodeURIComponent(longUser)
  )).json();
  if (!page.access_token) {
    console.error('PAGE_TOKEN_FAILED', JSON.stringify(page));
    process.exit(1);
  }
  console.log('PAGE_OK', page.id, page.name, 'len=' + page.access_token.length);

  envSet('FACEBOOK_PAGE_ACCESS_TOKEN', page.access_token);
  envSet('FACEBOOK_USER_LONG_TOKEN', longUser);

  const appToken = appId + '|' + appSecret;
  const dbg = await (await fetch(
    'https://graph.facebook.com/v21.0/debug_token?input_token=' +
    encodeURIComponent(page.access_token) + '&access_token=' + encodeURIComponent(appToken)
  )).json();
  const data = dbg.data || {};
  console.log('DEBUG', JSON.stringify({
    type: data.type,
    is_valid: data.is_valid,
    expires_at: data.expires_at,
    data_access_expires_at: data.data_access_expires_at,
    scopes: data.scopes,
  }, null, 2));

  const me = await (await fetch(
    'https://graph.facebook.com/v21.0/me?fields=id,name&access_token=' + encodeURIComponent(page.access_token)
  )).json();
  console.log('PAGE_ME', JSON.stringify(me));

  if (!data.expires_at) {
    console.log('RESULT: Page token is long-lived (expires_at=0 / never)');
  } else {
    console.log('RESULT: expires_at=' + new Date(data.expires_at * 1000).toISOString());
  }
  console.log('SAVED_TO_ENV');
})().catch(e => { console.error(e); process.exit(1); });
NODE

rm -f /tmp/fb_user_token.txt
pm2 restart app-unotrips-api --update-env
sleep 2
curl -sS 'http://127.0.0.1:5001/api/facebook/webhook/debug?token=unotrips-fb-verify-2026' | python3 -c "import sys,json; j=json.load(sys.stdin); print(json.dumps({'configured':j.get('configured'),'pageToken':j.get('pageToken'),'hasAppSecret':j.get('hasAppSecret')}, indent=2))"
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
