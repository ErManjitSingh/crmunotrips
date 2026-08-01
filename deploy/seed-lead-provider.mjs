/**
 * Upsert Lead Provider role + login user on live app DB.
 *
 *   $env:VPS_PASSWORD='...'; node deploy/seed-lead-provider.mjs
 */
import { Client } from 'ssh2';

const PASSWORD = process.env.VPS_PASSWORD;
const APP = '/var/www/app-unotrips-crm';

if (!PASSWORD) {
  console.error('Set VPS_PASSWORD');
  process.exit(1);
}

const remoteScript = `
set -e
cd ${APP}/backend
node src/scripts/seedLeadProvider.js
`;

const conn = new Client();
conn
  .on('ready', () => {
    console.log('==> Seeding Lead Provider on app.unotrips.com');
    conn.exec(remoteScript, (err, stream) => {
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
  .on('error', (e) => {
    console.error(e);
    process.exit(1);
  })
  .connect({
    host: process.env.VPS_HOST || '69.62.76.249',
    port: Number(process.env.VPS_PORT || 22),
    username: process.env.VPS_USER || 'root',
    password: PASSWORD,
  });
