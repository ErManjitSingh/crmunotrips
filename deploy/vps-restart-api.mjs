import { Client } from 'ssh2';
const PASSWORD = process.env.VPS_PASSWORD;
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
    await exec(
      conn,
      `cd /var/www/testing-unotrips-crm/backend
node -e "require('./src/services/unoHotelsPackageService'); require('./src/services/navCountsService'); console.log('modules_ok')"
cd /var/www/testing-unotrips-crm
pm2 delete testing-unotrips-api 2>/dev/null || true
pm2 start deploy/ecosystem.config.cjs --update-env
sleep 3
pm2 status
curl -sf http://127.0.0.1:5000/api/health
echo ""
`
    );
  } finally {
    conn.end();
  }
});
conn.connect({ host: '69.62.76.249', port: 22, username: 'root', password: PASSWORD });
