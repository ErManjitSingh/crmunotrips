/**
 * Enable auto lead assignment on live app.unotrips.com:
 * - set LEAD_AUTO_ASSIGNMENT_ENABLED=true in app .env
 * - turn on destination + skill auto-assign for all branch settings
 * - restart PM2 API
 *
 *   $env:VPS_PASSWORD='...'; node deploy/enable-auto-assign.mjs
 */
import { Client } from 'ssh2';

const PASSWORD = process.env.VPS_PASSWORD;
const HOST = process.env.VPS_HOST || '69.62.76.249';
const USER = process.env.VPS_USER || 'root';
const PORT = Number(process.env.VPS_PORT || 22);
const APP = '/var/www/app-unotrips-crm';

if (!PASSWORD) {
  console.error('Set VPS_PASSWORD environment variable.');
  process.exit(1);
}

const script = `set -e
APP=${APP}
ENV_FILE="$APP/.env"
BACKEND_ENV="$APP/backend/.env"

ensure_env() {
  local file="$1"
  [ -f "$file" ] || return 0
  if grep -q '^LEAD_AUTO_ASSIGNMENT_ENABLED=' "$file"; then
    sed -i 's/^LEAD_AUTO_ASSIGNMENT_ENABLED=.*/LEAD_AUTO_ASSIGNMENT_ENABLED=true/' "$file"
  else
    printf '\\nLEAD_AUTO_ASSIGNMENT_ENABLED=true\\n' >> "$file"
  fi
  echo "==> Updated $file"
  grep '^LEAD_AUTO_ASSIGNMENT_ENABLED=' "$file" || true
}

ensure_env "$ENV_FILE"
ensure_env "$BACKEND_ENV"

cat > "$APP/backend/tmp-enable-auto-assign.js" <<'NODE'
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join('/var/www/app-unotrips-crm', '.env') });
require('dotenv').config({ path: path.join('/var/www/app-unotrips-crm/backend', '.env') });
(async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('NO_URI');
  await mongoose.connect(uri);
  const BranchAssignmentSettings = require('./src/models/BranchAssignmentSettings');
  const Branch = require('./src/models/Branch');
  const result = await BranchAssignmentSettings.updateMany(
    {},
    { $set: { autoAssignEnabled: true, skillAutoAssignEnabled: true } }
  );
  const branches = await Branch.find({ status: 'active' }).select('_id name').lean();
  for (const branch of branches) {
    await BranchAssignmentSettings.findOneAndUpdate(
      { branchId: branch._id },
      {
        $set: { autoAssignEnabled: true, skillAutoAssignEnabled: true },
        $setOnInsert: { branchId: branch._id, fallbackUserIds: [], salesManagerQueueIds: [] },
      },
      { upsert: true }
    );
  }
  const rows = await BranchAssignmentSettings.find({}).lean();
  console.log(JSON.stringify({
    updated: result.modifiedCount,
    matched: result.matchedCount,
    branches: branches.length,
    settings: rows.map((r) => ({
      branchId: String(r.branchId),
      autoAssignEnabled: r.autoAssignEnabled,
      skillAutoAssignEnabled: r.skillAutoAssignEnabled,
    })),
  }));
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
NODE

cd "$APP/backend" && node tmp-enable-auto-assign.js
rm -f "$APP/backend/tmp-enable-auto-assign.js"

pm2 restart app-unotrips-api --update-env || true
sleep 2
curl -sS http://127.0.0.1:5001/api/assignment 2>/dev/null || curl -sS https://app.unotrips.com/api/assignment || true
echo
echo ENABLE_AUTO_ASSIGN_OK
`;

const conn = new Client();
conn
  .on('ready', () => {
    conn.exec(script, (err, stream) => {
      if (err) {
        console.error(err);
        conn.end();
        process.exit(1);
      }
      stream.on('data', (d) => process.stdout.write(d.toString()));
      stream.stderr.on('data', (d) => process.stderr.write(d.toString()));
      stream.on('close', (code) => {
        conn.end();
        process.exit(code || 0);
      });
    });
  })
  .connect({ host: HOST, port: PORT, username: USER, password: PASSWORD });
