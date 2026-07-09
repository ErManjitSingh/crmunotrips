import { Client } from 'ssh2';

const PASSWORD = process.env.VPS_PASSWORD;
if (!PASSWORD) process.exit(1);

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
      `echo '=== backup env ==='
ls -la /var/www/testing-unotrips-crm-backup-20260602-135428/backend/.env 2>/dev/null || true
head -5 /var/www/testing-unotrips-crm-backup-20260602-135428/backend/.env 2>/dev/null || true
echo '=== ports ==='
ss -tlnp | grep -E ':5000|:3000|:80|:443' || true
echo '=== certbot certs ==='
ls -la /etc/letsencrypt/live/ 2>/dev/null || true
`
    );
  } finally {
    conn.end();
  }
});
conn.connect({ host: '69.62.76.249', port: 22, username: 'root', password: PASSWORD });
