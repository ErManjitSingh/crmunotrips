import { Client } from 'ssh2';
const PASSWORD = process.env.VPS_PASSWORD;
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
  await exec(conn, 'pm2 status; echo ---; pm2 logs testing-unotrips-api --lines 30 --nostream; echo ---; curl -sf http://127.0.0.1:5000/api/health || echo health_fail');
  conn.end();
});
conn.connect({ host: '69.62.76.249', port: 22, username: 'root', password: PASSWORD });
