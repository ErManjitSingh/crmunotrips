/**
 * Probe live WA sources via SSH.
 *   $env:VPS_PASSWORD='...'; node deploy/probe-wa-sources.mjs
 */
import { Client } from 'ssh2';

const PASSWORD = process.env.VPS_PASSWORD;
if (!PASSWORD) {
  console.error('Set VPS_PASSWORD');
  process.exit(1);
}

const script = `set -e
cd /var/www/app-unotrips-crm
# ensure probe file from git
test -f deploy/probe-wa-sources-local.mjs || git fetch origin main && git checkout origin/main -- deploy/probe-wa-sources-local.mjs
node deploy/probe-wa-sources-local.mjs
`;

const conn = new Client();
conn
  .on('ready', () => {
    conn.exec(script, { pty: true }, (err, stream) => {
      if (err) throw err;
      stream.on('data', (d) => process.stdout.write(d));
      stream.stderr.on('data', (d) => process.stderr.write(d));
      stream.on('close', (code) => {
        conn.end();
        process.exit(code || 0);
      });
    });
  })
  .connect({
    host: process.env.VPS_HOST || '69.62.76.249',
    port: Number(process.env.VPS_PORT || 22),
    username: process.env.VPS_USER || 'root',
    password: PASSWORD,
  });
