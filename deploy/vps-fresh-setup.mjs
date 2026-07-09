/**
 * Fresh VPS setup: clone GitHub repo, deploy CRM, fix nginx for testing.unotrips.com
 * Run: $env:VPS_PASSWORD='...'; node deploy/vps-fresh-setup.mjs
 */
import { Client } from 'ssh2';

const PASSWORD = process.env.VPS_PASSWORD;
const APP = '/var/www/testing-unotrips-crm';
const BACKUP = '/var/www/testing-unotrips-crm-backup-20260602-135428';
const REPO = 'https://github.com/ErManjitSingh/crmunotrips.git';

if (!PASSWORD) {
  console.error('Set VPS_PASSWORD');
  process.exit(1);
}

function exec(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, { pty: true }, (err, stream) => {
      if (err) return reject(err);
      stream.on('data', (d) => process.stdout.write(d));
      stream.stderr.on('data', (d) => process.stderr.write(d));
      stream.on('close', (code) => (code ? reject(new Error(`exit ${code}`)) : resolve()));
    });
  });
}

const script = `set -e
export DEBIAN_FRONTEND=noninteractive

echo "==> Clone or sync repo..."
if [ ! -d "${APP}/.git" ]; then
  rm -rf "${APP}"
  git clone -b main "${REPO}" "${APP}"
else
  cd "${APP}"
  git remote set-url origin "${REPO}"
  git fetch origin main
  git checkout -B main origin/main
  git reset --hard origin/main
  git clean -fd
fi

echo "==> Backend .env..."
if [ -f "${BACKUP}/backend/.env" ]; then
  cp "${BACKUP}/backend/.env" "${APP}/backend/.env"
elif [ ! -f "${APP}/backend/.env" ]; then
  cp "${APP}/deploy/env/backend.env.production" "${APP}/backend/.env"
fi

echo "==> Frontend .env..."
cp "${APP}/deploy/env/frontend.env.production" "${APP}/frontend/.env"

echo "==> MongoDB check..."
systemctl is-active mongod >/dev/null 2>&1 || systemctl start mongod 2>/dev/null || true

echo "==> Backend install..."
cd "${APP}/backend"
npm install --omit=dev

echo "==> Frontend build..."
cd "${APP}/frontend"
npm install
npm run build

echo "==> PM2..."
mkdir -p "${APP}/logs"
cd "${APP}"
pm2 delete testing-unotrips-api 2>/dev/null || true
pm2 start deploy/ecosystem.config.cjs --update-env
pm2 save

echo "==> Nginx testing.unotrips.com..."
cp "${APP}/deploy/nginx/testing.unotrips.com.conf" /etc/nginx/sites-available/testing.unotrips.com
ln -sf /etc/nginx/sites-available/testing.unotrips.com /etc/nginx/sites-enabled/testing.unotrips.com
nginx -t
systemctl reload nginx

echo "==> Health checks..."
sleep 3
curl -sf http://127.0.0.1:5000/api/health
echo ""
curl -sk -o /dev/null -w "https local %{http_code}\\n" -H "Host: testing.unotrips.com" https://127.0.0.1/
echo "VPS_FRESH_SETUP_OK"
`;

const conn = new Client();
conn.on('ready', async () => {
  console.log('SSH connected — setting up testing.unotrips.com CRM...\n');
  try {
    await exec(conn, script);
  } catch (e) {
    console.error('\nSetup failed:', e.message);
    process.exitCode = 1;
  } finally {
    conn.end();
  }
});
conn.on('error', (e) => {
  console.error('SSH error:', e.message);
  process.exit(1);
});
conn.connect({ host: '69.62.76.249', port: 22, username: 'root', password: PASSWORD, readyTimeout: 60000 });
