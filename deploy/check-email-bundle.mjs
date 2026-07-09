import { Client } from 'ssh2';

const PASSWORD = process.env.VPS_PASSWORD;
const APP = '/var/www/testing-unotrips-crm';

const conn = new Client();
conn.on('ready', () => {
  conn.exec(
    `cd ${APP} && echo GIT_HEAD && git log -1 --oneline && echo PLACEHOLDER && (grep -rl "Select an item to read" frontend/dist/assets/*.js 2>/dev/null || echo NONE) && echo HIDDEN_PANE && (grep -rl "only after clicking" frontend/src/components/email/GmailMailbox.jsx 2>/dev/null || echo NO)`,
    { pty: true },
    (err, stream) => {
      stream.on('data', (d) => process.stdout.write(d));
      stream.on('close', () => conn.end());
    }
  );
}).connect({ host: '69.62.76.249', port: 22, username: 'root', password: PASSWORD });
