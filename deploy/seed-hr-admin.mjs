/**
 * Run seedHrAdmin on VPS after deploy.
 *   $env:VPS_PASSWORD='...'; node deploy/seed-hr-admin.mjs
 */
import { Client } from 'ssh2';

const PASSWORD = process.env.VPS_PASSWORD;
const HOST = process.env.VPS_HOST || '69.62.76.249';
const USER = process.env.VPS_USER || 'root';
const APP_ROOT = '/var/www/testing-unotrips-crm';

if (!PASSWORD) {
  console.error('Set VPS_PASSWORD environment variable.');
  process.exit(1);
}

function exec(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, { pty: true }, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      stream.on('data', (d) => {
        process.stdout.write(d);
        out += d;
      });
      stream.stderr.on('data', (d) => process.stderr.write(d));
      stream.on('close', (code) => {
        if (code !== 0) reject(new Error(`Exit ${code}`));
        else resolve(out);
      });
    });
  });
}

const conn = new Client();
conn
  .on('ready', async () => {
    console.log('SSH connected — seeding HR admin...\n');
    try {
      await exec(conn, `cd ${APP_ROOT}/backend && node src/scripts/seedHrAdmin.js`);
      console.log('\nSEED_HR_ADMIN_OK');
    } catch (e) {
      console.error('\nSeed failed:', e.message);
      process.exitCode = 1;
    } finally {
      conn.end();
    }
  })
  .on('error', (e) => {
    console.error('SSH error:', e.message);
    process.exit(1);
  })
  .connect({ host: HOST, port: 22, username: USER, password: PASSWORD, readyTimeout: 30000 });
