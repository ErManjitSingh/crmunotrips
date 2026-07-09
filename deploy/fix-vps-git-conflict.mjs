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
      stream.on('data', (d) => process.stdout.write(d));
      stream.stderr.on('data', (d) => process.stderr.write(d));
      stream.on('close', (code) => {
        if (code !== 0) reject(new Error(`Exit ${code}`));
        else resolve();
      });
    });
  });
}

const conn = new Client();
conn
  .on('ready', async () => {
    try {
      await exec(
        conn,
        `cd ${APP_ROOT} && rm -f backend/src/scripts/seedWhatsappDemo.js deploy/seed-whatsapp-demo.mjs && git clean -fd`
      );
      console.log('VPS_GIT_CONFLICT_FIXED');
    } catch (e) {
      console.error(e.message);
      process.exitCode = 1;
    } finally {
      conn.end();
      process.exit(process.exitCode || 0);
    }
  })
  .on('error', (e) => {
    console.error(e);
    process.exit(1);
  })
  .connect({ host: HOST, port: PORT, username: USER, password: PASSWORD });
