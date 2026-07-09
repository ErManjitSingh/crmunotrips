import { Client } from 'ssh2';

const PASSWORD = process.env.VPS_PASSWORD;
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
    await exec(
      conn,
      `set -e
echo '=== /var/www ==='
ls -la /var/www || true
echo '=== PM2 ==='
pm2 status || true
echo '=== nginx sites-enabled ==='
ls -la /etc/nginx/sites-enabled/ || true
echo '=== testing.unotrips nginx ==='
grep -R "testing.unotrips" /etc/nginx/sites-enabled/ /etc/nginx/sites-available/ 2>/dev/null | head -20 || true
echo '=== curl local ==='
curl -s -o /dev/null -w 'http:5000 health %{http_code}\n' http://127.0.0.1:5000/api/health || true
curl -s -o /dev/null -w 'http:80 %{http_code}\n' -H 'Host: testing.unotrips.com' http://127.0.0.1/ || true
`
    );
  } finally {
    conn.end();
  }
});
conn.connect({ host: '69.62.76.249', port: 22, username: 'root', password: PASSWORD });
