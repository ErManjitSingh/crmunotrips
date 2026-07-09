import { Client } from 'ssh2';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PASSWORD = process.env.VPS_PASSWORD;
const HOST = process.env.VPS_HOST || '69.62.76.249';
const APP_ROOT = '/var/www/testing-unotrips-crm';

const localScript = readFileSync(join(__dirname, 'check-replies-inline.js'));

const conn = new Client();
conn
  .on('ready', () => {
    conn.sftp((err, sftp) => {
      if (err) throw err;
      const ws = sftp.createWriteStream(`${APP_ROOT}/backend/check-replies-inline.js`);
      ws.on('close', () => {
        conn.exec(`cd ${APP_ROOT}/backend && node check-replies-inline.js`, { pty: true }, (e, stream) => {
          if (e) throw e;
          stream.on('data', (d) => process.stdout.write(d));
          stream.stderr.on('data', (d) => process.stderr.write(d));
          stream.on('close', () => conn.end());
        });
      });
      ws.end(localScript);
    });
  })
  .connect({ host: HOST, port: 22, username: 'root', password: PASSWORD });
