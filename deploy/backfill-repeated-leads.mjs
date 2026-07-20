/**
 * Backfill isRepeatCustomer for existing duplicate-phone leads on VPS.
 *   $env:VPS_PASSWORD='...'; node deploy/backfill-repeated-leads.mjs
 */
import { Client } from 'ssh2';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PASSWORD = process.env.VPS_PASSWORD;
const HOST = process.env.VPS_HOST || '69.62.76.249';
const LOCAL = path.resolve(__dirname, '../backend/src/scripts/backfillRepeatedLeads.js');
const REMOTE = '/var/www/testing-unotrips-crm/backend/src/scripts/backfillRepeatedLeads.js';

if (!PASSWORD) {
  console.error('Set VPS_PASSWORD');
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
      stream.stderr?.on('data', (d) => process.stderr.write(d));
      stream.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(`exit ${code}: ${out.slice(-400)}`))));
    });
  });
}

function upload(sftp, local, remote) {
  return new Promise((resolve, reject) => {
    sftp.fastPut(local, remote, (err) => (err ? reject(err) : resolve()));
  });
}

async function main() {
  const conn = new Client();
  await new Promise((resolve, reject) => {
    conn.on('ready', resolve).on('error', reject).connect({
      host: HOST,
      port: 22,
      username: 'root',
      password: PASSWORD,
    });
  });

  const sftp = await new Promise((resolve, reject) => {
    conn.sftp((err, s) => (err ? reject(err) : resolve(s)));
  });
  await upload(sftp, LOCAL, REMOTE);
  console.log('Uploaded backfillRepeatedLeads.js\n');

  await exec(conn, 'cd /var/www/testing-unotrips-crm/backend && node src/scripts/backfillRepeatedLeads.js');
  conn.end();
  console.log('\nBACKFILL_REPEATED_OK');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
