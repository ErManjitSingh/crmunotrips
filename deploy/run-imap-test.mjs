import { Client } from 'ssh2';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PASSWORD = process.env.VPS_PASSWORD;
const HOST = process.env.VPS_HOST || '69.62.76.249';
const USER = process.env.VPS_USER || 'root';
const APP_ROOT = '/var/www/testing-unotrips-crm';
const REMOTE = `${APP_ROOT}/backend/imap-test-inline.js`;

if (!PASSWORD) {
  console.error('Set VPS_PASSWORD');
  process.exit(1);
}

const localScript = readFileSync(join(__dirname, 'imap-test-inline.js'));

const conn = new Client();
conn
  .on('ready', () => {
    conn.sftp((err, sftp) => {
      if (err) throw err;
      const ws = sftp.createWriteStream(REMOTE);
      ws.on('close', () => {
        conn.exec(`cd ${APP_ROOT}/backend && node imap-test-inline.js`, { pty: true }, (e, stream) => {
          if (e) throw e;
          stream.on('data', (d) => process.stdout.write(d));
          stream.stderr.on('data', (d) => process.stderr.write(d));
          stream.on('close', () => conn.end());
        });
      });
      ws.end(localScript);
    });
  })
  .on('error', (e) => {
    console.error(e);
    process.exit(1);
  })
  .connect({ host: HOST, port: 22, username: USER, password: PASSWORD });
