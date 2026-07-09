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
