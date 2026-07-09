/**
 * Deploy Uno packages integration to VPS.
 * Run: $env:VPS_PASSWORD='...'; node deploy/deploy-uno-packages.mjs
 */
import { Client } from 'ssh2';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const APP = '/var/www/testing-unotrips-crm';
const PASSWORD = process.env.VPS_PASSWORD;

const FILES = [
  'backend/src/models/Package.js',
  'backend/src/controllers/packageController.js',
  'backend/src/routes/packageRoutes.js',
  'backend/src/services/unoHotelsApiClient.js',
  'backend/src/services/unoHotelsPackageService.js',
  'backend/src/services/navCountsService.js',
  'frontend/src/components/packages/PackageManagementPage.jsx',
  'frontend/src/components/packages/PackageDetailModal.jsx',
  'frontend/src/components/packages/PackageFormModal.jsx',
  'frontend/src/components/packages/UnoPackageListTable.jsx',
  'frontend/src/components/quotations/QuotationBuilderWizard.jsx',
  'frontend/src/lib/unoPublicPackages.js',
  'deploy/env/backend.env.production',
];

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

const conn = new Client();
conn.on('ready', async () => {
  try {
    const sftp = await new Promise((res, rej) => conn.sftp((e, s) => (e ? rej(e) : res(s))));
    for (const rel of FILES) {
      const local = path.join(ROOT, rel);
      const remote = `${APP}/${rel.replace(/\\/g, '/')}`;
      await new Promise((res, rej) => sftp.fastPut(local, remote, (e) => (e ? rej(e) : res())));
      console.log('Uploaded', rel);
    }

    await exec(
      conn,
      `set -e
cd ${APP}
if grep -q UNO_HOTELS_API_BASE_URL backend/.env; then
  sed -i 's|UNO_HOTELS_API_BASE_URL=.*|UNO_HOTELS_API_BASE_URL=https://api.unohotelsandresorts.com|' backend/.env
else
  echo 'UNO_HOTELS_API_BASE_URL=https://api.unohotelsandresorts.com' >> backend/.env
fi
cd frontend
npm run build
cd ${APP}
pm2 restart testing-unotrips-api
sleep 2
curl -sf http://127.0.0.1:5000/api/health
echo ""
curl -sf 'http://127.0.0.1:5000/api/uno-packages?limit=1' | head -c 200
echo ""
echo UNO_PACKAGES_DEPLOY_OK
`
    );
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  } finally {
    conn.end();
  }
});
conn.connect({ host: '69.62.76.249', port: 22, username: 'root', password: PASSWORD });
