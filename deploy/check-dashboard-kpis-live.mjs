import { Client } from 'ssh2';

const PASSWORD = process.env.VPS_PASSWORD;
if (!PASSWORD) {
  console.error('Set VPS_PASSWORD');
  process.exit(1);
}

const script = `set -e
echo "==> Deployed dashboardService markers"
grep -n "CONNECTED_STATUSES" /var/www/app-unotrips-crm/backend/src/services/dashboardService.js | head -5 || echo "CONNECTED_STATUSES NOT FOUND"
grep -n "sumStatusCounts" /var/www/app-unotrips-crm/backend/src/services/dashboardService.js | head -5 || echo "sumStatusCounts NOT FOUND"
git -C /var/www/app-unotrips-crm log -1 --oneline

echo "==> PM2 status"
pm2 jlist 2>/dev/null | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); d.filter(p=>p.name&&p.name.includes('app-unotrips')).forEach(p=>console.log(p.name,p.pm2_env.status,p.pm2_env.pm_uptime));"

echo "==> Dashboard KPI probe"
cd /var/www/app-unotrips-crm
node deploy/check-dashboard-kpis-local.cjs
`;

function exec(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, { pty: true }, (err, stream) => {
      if (err) return reject(err);
      stream.on('data', (d) => process.stdout.write(d));
      stream.stderr.on('data', (d) => process.stderr.write(d));
      stream.on('close', (code) => resolve(code));
    });
  });
}

const conn = new Client();
conn.on('ready', async () => {
  try {
    const code = await exec(conn, script);
    process.exit(code || 0);
  } finally {
    conn.end();
  }
});
conn.on('error', (e) => {
  console.error(e.message);
  process.exit(1);
});
conn.connect({
  host: process.env.VPS_HOST || '69.62.76.249',
  port: Number(process.env.VPS_PORT || 22),
  username: process.env.VPS_USER || 'root',
  password: PASSWORD,
});
