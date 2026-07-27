/**
 * Try to fetch Page access_token field for New Pages Experience.
 *   $env:VPS_PASSWORD='...'; node deploy/fetch-page-access-token.mjs
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
const userToken = env.split(/\\r?\\n/).find(l => l.startsWith('FACEBOOK_PAGE_ACCESS_TOKEN=')).split('=').slice(1).join('=').trim();
const PAGE_ID = '928275203698122';
(async () => {
  const url = 'https://graph.facebook.com/v21.0/' + PAGE_ID + '?fields=id,name,access_token&access_token=' + encodeURIComponent(userToken);
  const data = await (await fetch(url)).json();
  console.log(JSON.stringify(data, null, 2));
  if (!data.access_token) {
    console.log('NO_PAGE_ACCESS_TOKEN_FIELD');
    process.exit(2);
  }
  const lines = env.split(/\\r?\\n/).filter(l => l && !l.startsWith('FACEBOOK_PAGE_ACCESS_TOKEN='));
  lines.push('FACEBOOK_PAGE_ACCESS_TOKEN=' + data.access_token);
  fs.writeFileSync('.env', lines.join('\\n') + '\\n');
  const me = await (await fetch('https://graph.facebook.com/v21.0/me?fields=id,name&access_token=' + encodeURIComponent(data.access_token))).json();
  console.log('PAGE_ME', JSON.stringify(me));
  console.log('SAVED_PAGE_TOKEN len=' + data.access_token.length);
})().catch(e => { console.error(e); process.exit(1); });
NODE
`;

const c = new Client();
c.on('ready', () => {
  c.exec(remote, (_e, stream) => {
    let code = 0;
    stream.on('data', (d) => process.stdout.write(d));
    stream.stderr.on('data', (d) => process.stderr.write(d));
    stream.on('close', (cde) => {
      code = cde || 0;
      c.end();
      process.exit(code);
    });
  });
});
c.connect({
  host: process.env.VPS_HOST || '69.62.76.249',
  port: 22,
  username: 'root',
  password: PASSWORD,
});
