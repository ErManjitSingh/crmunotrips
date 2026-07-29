/**
 * Configure SMTP/IMAP on live app.unotrips.com only.
 * Uses local backend/.env SMTP_* if env vars not passed.
 *
 *   $env:VPS_PASSWORD='...'; node deploy/configure-smtp-app.mjs
 */
import { Client } from 'ssh2';
import { readFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localEnvPath = path.resolve(__dirname, '../backend/.env');
const localEnv = {};
if (existsSync(localEnvPath)) {
  for (const line of readFileSync(localEnvPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) localEnv[m[1]] = m[2];
  }
}
function env(key, fallback = '') {
  return process.env[key] || localEnv[key] || fallback;
}

const PASSWORD = process.env.VPS_PASSWORD;
const HOST = process.env.VPS_HOST || '69.62.76.249';
const USER = process.env.VPS_USER || 'root';
const PORT = Number(process.env.VPS_PORT || 22);
const APP_ROOT = '/var/www/app-unotrips-crm';

const SMTP_HOST = env('SMTP_HOST', 'smtp.hostinger.com');
const SMTP_PORT = env('SMTP_PORT', '465');
const SMTP_USER = env('SMTP_USER', 'sales@unotrips.com');
const SMTP_PASS = env('SMTP_PASS');
const SMTP_FROM_NAME = env('SMTP_FROM_NAME', 'UNO Trips');
const IMAP_HOST = env('IMAP_HOST', 'imap.hostinger.com');
const IMAP_PORT = env('IMAP_PORT', '993');

if (!PASSWORD) {
  console.error('Set VPS_PASSWORD environment variable.');
  process.exit(1);
}
if (!SMTP_PASS) {
  console.error('Set SMTP_PASS (or put it in backend/.env).');
  process.exit(1);
}

function exec(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, { pty: true }, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      stream.on('data', (d) => {
        process.stdout.write(d);
        out += d;
      });
      stream.stderr.on('data', (d) => process.stderr.write(d));
      stream.on('close', (code) => {
        if (code !== 0) reject(new Error(`Exit ${code}`));
        else resolve(out);
      });
    });
  });
}

function shQuote(value) {
  return `'${String(value).replace(/'/g, `'\"'\"'`)}'`;
}

const script = `set -e
ENV_FILE=${APP_ROOT}/backend/.env
touch "$ENV_FILE"

upsert() {
  key="$1"
  val="$2"
  if grep -q "^\${key}=" "$ENV_FILE"; then
    # escape | in val for sed
    esc=$(printf '%s' "\$val" | sed 's/[&|\\\\]/\\\\&/g')
    sed -i "s|^\${key}=.*|\${key}=\${esc}|" "$ENV_FILE"
  else
    echo "\${key}=\${val}" >> "$ENV_FILE"
  fi
}

upsert SMTP_HOST ${shQuote(SMTP_HOST)}
upsert SMTP_PORT ${shQuote(SMTP_PORT)}
upsert SMTP_USER ${shQuote(SMTP_USER)}
upsert SMTP_PASS ${shQuote(SMTP_PASS)}
upsert SMTP_FROM_NAME ${shQuote(SMTP_FROM_NAME)}
upsert IMAP_HOST ${shQuote(IMAP_HOST)}
upsert IMAP_PORT ${shQuote(IMAP_PORT)}
upsert IMAP_USER ${shQuote(SMTP_USER)}
upsert IMAP_PASS ${shQuote(SMTP_PASS)}

echo "==> SMTP vars set (password hidden)"
grep -E '^SMTP_(HOST|PORT|USER|FROM_NAME)=' "$ENV_FILE"
grep -E '^IMAP_(HOST|PORT|USER)=' "$ENV_FILE"
echo "SMTP_PASS/IMAP_PASS: set"

echo "==> SMTP verify after write"
cd ${APP_ROOT}/backend
node -e "
require('dotenv').config();
const nodemailer = require('nodemailer');
const port = Number(process.env.SMTP_PORT || 465);
const t = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port,
  secure: port === 465,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});
(async () => {
  await t.verify();
  console.log('SMTP verify: OK');
  const info = await t.sendMail({
    from: '\\\"' + (process.env.SMTP_FROM_NAME || 'UNO Trips') + '\\\" <' + process.env.SMTP_USER + '>',
    to: process.env.SMTP_USER,
    subject: 'App SMTP configured ' + new Date().toISOString(),
    text: 'SMTP configured on app.unotrips.com',
  });
  console.log('Send: OK', info.messageId);
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
"

echo "==> PM2 restart app-unotrips-api"
pm2 restart app-unotrips-api --update-env
pm2 save
sleep 2
curl -sf http://127.0.0.1:5001/api/health || curl -sf http://127.0.0.1:5000/api/health || true
echo ""
node -e "
require('./src/config/env');
const { isEmailConfigured } = require('./src/services/emailService');
console.log('isEmailConfigured after restart check (file):', isEmailConfigured());
"
echo "CONFIGURE_SMTP_APP_OK"
`;

const conn = new Client();
conn
  .on('ready', async () => {
    console.log('SSH connected — configuring SMTP on app.unotrips.com\n');
    try {
      await exec(conn, script);
    } finally {
      conn.end();
    }
  })
  .on('error', (err) => {
    console.error(err);
    process.exit(1);
  })
  .connect({ host: HOST, port: PORT, username: USER, password: PASSWORD });
