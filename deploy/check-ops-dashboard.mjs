import { Client } from 'ssh2';

const PASSWORD = process.env.VPS_PASSWORD;
const HOST = process.env.VPS_HOST || '69.62.76.249';

if (!PASSWORD) {
  console.error('Set VPS_PASSWORD');
  process.exit(1);
}

const script = `cd /var/www/testing-unotrips-crm/backend && node <<'NODE'
require('dotenv').config();
const { connectDB } = require('./src/config/db');
const mongoose = require('mongoose');
const Booking = require('./src/models/Booking');
const User = require('./src/models/User');
const opsService = require('./src/services/operationsService');

(async () => {
  await connectDB();
  const ops = await User.findOne({ email: 'ops@crm.com' }).lean();
  const admin = await User.findOne({ email: 'admin@crm.com' }).lean();
  const total = await Booking.countDocuments({ archivedAt: { $exists: false } });
  const opsBranch = await Booking.countDocuments({ archivedAt: { $exists: false }, branchId: ops.branchId });
  const dashAll = await opsService.getDashboard(null);
  const dashOps = await opsService.getDashboard(ops.branchId);
  const dashAdminBranch = admin?.branchId ? await opsService.getDashboard(admin.branchId) : null;
  console.log(JSON.stringify({
    opsBranchId: String(ops.branchId),
    adminBranchId: admin?.branchId ? String(admin.branchId) : null,
    totalBookings: total,
    opsBranchBookings: opsBranch,
    dashAllKpis: dashAll.kpis,
    dashOpsKpis: dashOps.kpis,
    dashAdminBranchKpis: dashAdminBranch?.kpis,
    branchStatsAll: dashAll.branchStats,
  }, null, 2));
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
NODE`;

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
    await exec(conn, script);
  } finally {
    conn.end();
  }
}).connect({ host: HOST, port: 22, username: 'root', password: PASSWORD });
