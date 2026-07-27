/**
 * Set FACEBOOK_APP_ID / FACEBOOK_APP_SECRET on live VPS and restart API.
 *   $env:VPS_PASSWORD='...'
 *   $env:FACEBOOK_APP_ID='...'
 *   $env:FACEBOOK_APP_SECRET='...'
 *   node deploy/set-facebook-app-secret.mjs
 */
import { Client } from 'ssh2';

const PASSWORD = process.env.VPS_PASSWORD;
const APP_ID = (process.env.FACEBOOK_APP_ID || '').trim();
const APP_SECRET = (process.env.FACEBOOK_APP_SECRET || '').trim();

if (!PASSWORD) {
  console.error('Set VPS_PASSWORD');
  process.exit(1);
}
if (!APP_SECRET) {
  console.error('Set FACEBOOK_APP_SECRET');
  process.exit(1);
}

const remote = `
set -e
ENV=/var/www/app-unotrips-crm/backend/.env
APP_ID='${APP_ID.replace(/'/g, "'\\''")}'
APP_SECRET='${APP_SECRET.replace(/'/g, "'\\''")}'

touch "$ENV"
if [ -n "$APP_ID" ]; then
  if grep -q '^FACEBOOK_APP_ID=' "$ENV"; then
    sed -i "s|^FACEBOOK_APP_ID=.*|FACEBOOK_APP_ID=$APP_ID|" "$ENV"
  else
    echo "FACEBOOK_APP_ID=$APP_ID" >> "$ENV"
  fi
fi
if grep -q '^FACEBOOK_APP_SECRET=' "$ENV"; then
  sed -i "s|^FACEBOOK_APP_SECRET=.*|FACEBOOK_APP_SECRET=$APP_SECRET|" "$ENV"
else
  echo "FACEBOOK_APP_SECRET=$APP_SECRET" >> "$ENV"
fi

echo "== MASKED ENV =="
grep -E '^FACEBOOK_APP_ID=|^FACEBOOK_APP_SECRET=|^FACEBOOK_PAGE_ACCESS_TOKEN=|^FACEBOOK_VERIFY_TOKEN=' "$ENV" | sed -E 's/(SECRET|TOKEN)=.*/\\1=***/'

pm2 restart app-unotrips-api --update-env
sleep 2
curl -sS 'http://127.0.0.1:5001/api/facebook/webhook/status'
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
