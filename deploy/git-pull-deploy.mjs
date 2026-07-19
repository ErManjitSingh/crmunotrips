import { Client } from 'ssh2';

const PASSWORD = process.env.VPS_PASSWORD;
const HOST = process.env.VPS_HOST || '69.62.76.249';
const USER = process.env.VPS_USER || 'root';
const PORT = Number(process.env.VPS_PORT || 22);
const APP_ROOT = '/var/www/testing-unotrips-crm';

if (!PASSWORD) {
  console.error('Set VPS_PASSWORD environment variable.');
  process.exit(1);
}

function exec(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, { pty: true }, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      let errOut = '';
      stream.on('data', (d) => {
        process.stdout.write(d);
        out += d;
      });
      stream.stderr.on('data', (d) => {
        process.stderr.write(d);
        errOut += d;
      });
      stream.on('close', (code) => {
        if (code !== 0) reject(new Error(`Exit ${code}: ${errOut || out}`));
        else resolve(out);
      });
    });
  });
}

const script = `set -e
export DEBIAN_FRONTEND=noninteractive
cd ${APP_ROOT}

echo "==> Git sync from origin/main..."
git fetch origin main
git checkout main 2>/dev/null || git checkout -b main
git reset --hard origin/main
git clean -fd

echo "==> Redis (optional cache)..."
systemctl enable redis-server 2>/dev/null || true
systemctl start redis-server 2>/dev/null || true

echo "==> Ensure META_LEAD_API_KEY in backend .env..."
cd ${APP_ROOT}/backend
if ! grep -q '^META_LEAD_API_KEY=' .env 2>/dev/null; then
  echo 'META_LEAD_API_KEY=unotrips-meta-lead-2026-secure' >> .env
fi
if ! grep -q '^FACEBOOK_VERIFY_TOKEN=' .env 2>/dev/null; then
  echo 'FACEBOOK_VERIFY_TOKEN=unotrips-fb-verify-2026' >> .env
fi
if ! grep -q '^FACEBOOK_DEFAULT_DESTINATION=' .env 2>/dev/null; then
  echo 'FACEBOOK_DEFAULT_DESTINATION=Not specified' >> .env
fi
if ! grep -q '^WHATSAPP_VERIFY_TOKEN=' .env 2>/dev/null; then
  echo 'WHATSAPP_VERIFY_TOKEN=unotrips-wa-verify-2026' >> .env
fi
if ! grep -q '^WHATSAPP_DEFAULT_DESTINATION=' .env 2>/dev/null; then
  echo 'WHATSAPP_DEFAULT_DESTINATION=Not specified' >> .env
fi
# Keep existing FACEBOOK_PAGE_ACCESS_TOKEN / FACEBOOK_APP_SECRET / WHATSAPP_ACCESS_TOKEN if already set.
if grep -q '^CORS_ORIGINS=' .env 2>/dev/null; then
  sed -i 's|^CORS_ORIGINS=.*|CORS_ORIGINS=https://testing.unotrips.com,https://unotrips.com,https://www.unotrips.com|' .env
else
  echo 'CORS_ORIGINS=https://testing.unotrips.com,https://unotrips.com,https://www.unotrips.com' >> .env
fi

echo "==> Backend install..."
cd ${APP_ROOT}/backend
if grep -q UNO_HOTELS_API_BASE_URL .env 2>/dev/null; then
  sed -i 's|UNO_HOTELS_API_BASE_URL=.*|UNO_HOTELS_API_BASE_URL=http://127.0.0.1:8000|' .env
else
  echo 'UNO_HOTELS_API_BASE_URL=http://127.0.0.1:8000' >> .env
fi
npm install --omit=dev

echo "==> Frontend build..."
cd ${APP_ROOT}/frontend
npm install
npm run build

echo "==> PM2 restart..."
cd ${APP_ROOT}
pm2 start deploy/ecosystem.config.cjs --update-env
pm2 save

echo "==> Nginx config sync..."
if [ -f ${APP_ROOT}/deploy/nginx/testing.unotrips.com.conf ]; then
  cp ${APP_ROOT}/deploy/nginx/testing.unotrips.com.conf /etc/nginx/sites-available/testing.unotrips.com
fi

echo "==> Nginx reload..."
nginx -t && systemctl reload nginx

echo "==> Health check..."
sleep 2
curl -sf http://127.0.0.1:5000/api/health
echo ""
echo "GIT_PULL_DEPLOY_OK"
`;

const conn = new Client();
conn
  .on('ready', async () => {
    console.log('SSH connected.\n');
    try {
      await exec(conn, script);
      console.log('\nDeploy finished. Test: http://testing.unotrips.com/api/health');
    } catch (e) {
      console.error('\nDeploy failed:', e.message);
      process.exitCode = 1;
    } finally {
      conn.end();
    }
  })
  .on('error', (e) => {
    console.error('SSH error:', e.message);
    process.exit(1);
  })
  .connect({ host: HOST, port: PORT, username: USER, password: PASSWORD, readyTimeout: 30000 });
