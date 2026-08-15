/**
 * Production deploy — app.unotrips.com ONLY.
 * Does not touch testing.unotrips.com.
 *
 *   $env:VPS_PASSWORD='...'; node deploy/deploy-app-only.mjs
 *   $env:VPS_PASSWORD='...'; node deploy/deploy-app-only.mjs --disable-testing
 */
import { Client } from 'ssh2';

const PASSWORD = process.env.VPS_PASSWORD;
const HOST = process.env.VPS_HOST || '69.62.76.249';
const USER = process.env.VPS_USER || 'root';
const PORT = Number(process.env.VPS_PORT || 22);
const APP_ROOT = '/var/www/app-unotrips-crm';
const REPO = 'https://github.com/ErManjitSingh/crmunotrips.git';
const disableTesting = process.argv.includes('--disable-testing');

if (!PASSWORD) {
  console.error('Set VPS_PASSWORD environment variable.');
  process.exit(1);
}

const script = `set -e
export DEBIAN_FRONTEND=noninteractive
APP=${APP_ROOT}
REPO=${REPO}

echo "==> Deploy to app.unotrips.com only (not testing)..."
mkdir -p "$APP"
cd "$APP"

if [ ! -d .git ]; then
  echo "==> Initializing git in app root (preserving .env)..."
  TMP=$(mktemp -d)
  git clone --depth 1 --branch main "$REPO" "$TMP/repo"
  # Keep existing env / logs / node_modules if present
  rsync -a --exclude '.env' --exclude 'logs' --exclude 'node_modules' --exclude 'frontend/dist' --exclude 'frontend/node_modules' --exclude 'backend/node_modules' "$TMP/repo/" "$APP/"
  rm -rf "$TMP"
  cd "$APP"
  git init
  git remote add origin "$REPO" 2>/dev/null || git remote set-url origin "$REPO"
  git fetch origin main
  git checkout -B main origin/main
else
  echo "==> Git pull origin/main..."
  git remote set-url origin "$REPO"
  git fetch origin main
  git checkout main 2>/dev/null || git checkout -b main
  git reset --hard origin/main
fi

# Ensure app env points at app domain if .env exists
if [ -f "$APP/backend/.env" ]; then
  sed -i 's|^PORT=.*|PORT=5001|' "$APP/backend/.env" || true
  if grep -q '^CORS_ORIGINS=' "$APP/backend/.env"; then
    sed -i 's|^CORS_ORIGINS=.*|CORS_ORIGINS=https://app.unotrips.com,https://unotrips.com,https://www.unotrips.com|' "$APP/backend/.env"
  fi
  if ! grep -q '^FACEBOOK_VERIFY_TOKEN=' "$APP/backend/.env" 2>/dev/null; then
    echo 'FACEBOOK_VERIFY_TOKEN=unotrips-fb-verify-2026' >> "$APP/backend/.env"
  fi
  if ! grep -q '^FACEBOOK_DEFAULT_DESTINATION=' "$APP/backend/.env" 2>/dev/null; then
    echo 'FACEBOOK_DEFAULT_DESTINATION=Not specified' >> "$APP/backend/.env"
  fi
  if ! grep -q '^FACEBOOK_GRAPH_VERSION=' "$APP/backend/.env" 2>/dev/null; then
    echo 'FACEBOOK_GRAPH_VERSION=v21.0' >> "$APP/backend/.env"
  fi
  if grep -q '^FACEBOOK_WEBHOOK_DEBUG=' "$APP/backend/.env" 2>/dev/null; then
    sed -i 's|^FACEBOOK_WEBHOOK_DEBUG=.*|FACEBOOK_WEBHOOK_DEBUG=true|' "$APP/backend/.env"
  else
    echo 'FACEBOOK_WEBHOOK_DEBUG=true' >> "$APP/backend/.env"
  fi
  if ! grep -q '^WHATSAPP_BUSINESS_ACCOUNT_ID=' "$APP/backend/.env" 2>/dev/null; then
    echo 'WHATSAPP_BUSINESS_ACCOUNT_ID=1316299840281529' >> "$APP/backend/.env"
  fi
  if grep -q '^WHATSAPP_DEFAULT_LEAD_SOURCE=' "$APP/backend/.env" 2>/dev/null; then
    sed -i 's|^WHATSAPP_DEFAULT_LEAD_SOURCE=.*|WHATSAPP_DEFAULT_LEAD_SOURCE=dpw_wa|' "$APP/backend/.env"
  else
    echo 'WHATSAPP_DEFAULT_LEAD_SOURCE=dpw_wa' >> "$APP/backend/.env"
  fi
  if ! grep -q '^UNO_HOTELS_RATE_OVERRIDE_CHANNEL=' "$APP/backend/.env" 2>/dev/null; then
    echo 'UNO_HOTELS_RATE_OVERRIDE_CHANNEL=staff' >> "$APP/backend/.env"
  fi
  if [ -f /var/www/uno-backend/.env ]; then
    OPS_USER=$(grep '^OPS_USERNAME=' /var/www/uno-backend/.env | cut -d= -f2- | tr -d '\r')
    OPS_PASS=$(grep '^OPS_PASSWORD=' /var/www/uno-backend/.env | cut -d= -f2- | tr -d '\r')
    if [ -n "$OPS_USER" ] && ! grep -q '^UNO_HOTELS_OPS_USERNAME=' "$APP/backend/.env" 2>/dev/null; then
      echo "UNO_HOTELS_OPS_USERNAME=$OPS_USER" >> "$APP/backend/.env"
    fi
    if [ -n "$OPS_PASS" ] && ! grep -q '^UNO_HOTELS_OPS_PASSWORD=' "$APP/backend/.env" 2>/dev/null; then
      echo "UNO_HOTELS_OPS_PASSWORD=$OPS_PASS" >> "$APP/backend/.env"
    fi
  fi
fi
if [ -f "$APP/frontend/.env" ]; then
  sed -i 's|^VITE_API_URL=.*|VITE_API_URL=https://app.unotrips.com/api|' "$APP/frontend/.env" || true
fi
if [ -f "$APP/frontend/.env.production" ]; then
  sed -i 's|^VITE_API_URL=.*|VITE_API_URL=https://app.unotrips.com/api|' "$APP/frontend/.env.production" || true
fi

echo "==> Backend install..."
cd "$APP/backend"
npm install --omit=dev

echo "==> Frontend build..."
cd "$APP/frontend"
npm install
npm run build

echo "==> PM2 restart app-unotrips-api only..."
cd "$APP"
mkdir -p "$APP/logs"
# startOrReload applies ecosystem (incl. 1G memory) without long downtime
pm2 startOrReload "$APP/deploy/ecosystem.app.config.cjs" --update-env
pm2 save

${disableTesting ? `
echo "==> Disabling testing.unotrips.com..."
pm2 stop testing-unotrips-api 2>/dev/null || true
pm2 delete testing-unotrips-api 2>/dev/null || true
pm2 save
if [ -L /etc/nginx/sites-enabled/testing.unotrips.com ]; then
  rm -f /etc/nginx/sites-enabled/testing.unotrips.com
fi
if [ -f /etc/nginx/sites-enabled/testing.unotrips.com ]; then
  rm -f /etc/nginx/sites-enabled/testing.unotrips.com
fi
nginx -t && systemctl reload nginx
echo "TESTING_DISABLED"
` : 'echo "==> Skipping testing disable (pass --disable-testing to shut it down)"'}

sleep 2
echo "==> Backfill lead sources..."
cd "$APP" && node deploy/backfill-lead-sources.mjs || echo "LEAD_SOURCE_BACKFILL_SKIPPED"
echo "==> Retag non-Meta WhatsApp leads → DPW WA (Google)..."
cd "$APP" && node deploy/retag-whatsapp-google-source.mjs || echo "WA_SOURCE_RETAG_SKIPPED"
echo "==> Sync lead_provider user-create permissions..."
cd "$APP/backend" && node src/scripts/syncLeadProviderPermissions.js || echo "LEAD_PROVIDER_PERMS_SYNC_SKIPPED"
curl -sS https://app.unotrips.com/api/health
echo
echo APP_ONLY_DEPLOY_OK
`;

function exec(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, { pty: true }, (err, stream) => {
      if (err) return reject(err);
      stream.on('data', (d) => process.stdout.write(d));
      stream.stderr.on('data', (d) => process.stderr.write(d));
      stream.on('close', (code) => {
        if (code !== 0) reject(new Error(`Exit ${code}`));
        else resolve();
      });
    });
  });
}

const conn = new Client();
conn
  .on('ready', async () => {
    console.log('SSH connected — deploying app.unotrips.com only.');
    try {
      await exec(conn, script);
      console.log('\nDeploy finished: https://app.unotrips.com');
    } catch (e) {
      console.error(e.message || e);
      process.exitCode = 1;
    } finally {
      conn.end();
    }
  })
  .on('error', (e) => {
    console.error(e);
    process.exit(1);
  })
  .connect({ host: HOST, port: PORT, username: USER, password: PASSWORD });
