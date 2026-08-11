const fs = require('fs');
const path = require('path');

const backendRoot = path.join(__dirname, '../backend');
process.chdir(backendRoot);
module.paths.unshift(path.join(backendRoot, 'node_modules'));

const mongoose = require('mongoose');
const { buildAdminDashboard } = require('./src/services/dashboardService');

const envPath = path.join(backendRoot, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

(async () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const today = `${yyyy}-${mm}-${dd}`;
  const monthFrom = `${yyyy}-${mm}-01`;

  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);

  for (const [label, dateFrom, dateTo] of [
    ['today', today, today],
    ['month', monthFrom, today],
    ['all', '', ''],
  ]) {
    const stats = await buildAdminDashboard({ dateFrom, dateTo });
    const kpis = stats.report?.kpis || {};
    const funnel = stats.report?.salesFunnel || [];
    console.log(`--- ${label} ---`);
    console.log('header connected:', kpis.connected?.value);
    console.log('header qualified:', kpis.qualified?.value);
    console.log('header quotations:', kpis.quotations?.value);
    console.log('funnel:', funnel.map((s) => `${s.stage}=${s.count}`).join(' | '));
  }

  await mongoose.disconnect();
})().catch((e) => {
  console.error('ERR', e.message);
  process.exit(1);
});
