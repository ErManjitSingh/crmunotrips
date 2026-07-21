/**
 * Sync Meta lander CRM ingest files to /var/www/unotrips-meta
 *   $env:VPS_PASSWORD='...'; node deploy/sync-meta-crm-ingest.mjs
 */
import { Client } from 'ssh2';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const META_ROOT = path.resolve(__dirname, '../../uno_nextjs_front/meta');
const REMOTE_ROOT = '/var/www/unotrips-meta';
const PASSWORD = process.env.VPS_PASSWORD;
const HOST = process.env.VPS_HOST || '69.62.76.249';

if (!PASSWORD) {
  console.error('Set VPS_PASSWORD');
  process.exit(1);
}

const DESTINATIONS = [
  'arunachal',
  'assam',
  'gujarat',
  'himachal_special',
  'kerala',
  'leh',
  'leh_tour_package',
  'rajasthan_tour_package',
];

const FILES = [
  'crm_lead_push.php',
  'send_lead.php',
  'send_chat.php',
  'index.php',
  'index.html',
  'script.js',
  'chatbot.js',
  'landing-interactive.js',
];

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
      stream.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(`exit ${code}`))));
    });
  });
}

function upload(sftp, local, remote) {
  return new Promise((resolve, reject) => {
    sftp.fastPut(local, remote, (err) => (err ? reject(err) : resolve()));
  });
}

function mkdirp(sftp, dir) {
  return new Promise((resolve) => {
    sftp.mkdir(dir, () => resolve());
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
  console.log('SSH connected.\n');

  await exec(conn, `mkdir -p ${REMOTE_ROOT}/_shared`);
  const sftp = await new Promise((resolve, reject) => {
    conn.sftp((err, s) => (err ? reject(err) : resolve(s)));
  });

  const sharedLocal = path.join(META_ROOT, '_shared', 'crm_lead_push.php');
  if (fs.existsSync(sharedLocal)) {
    await upload(sftp, sharedLocal, `${REMOTE_ROOT}/_shared/crm_lead_push.php`);
    console.log('uploaded _shared/crm_lead_push.php');
  }

  for (const dest of DESTINATIONS) {
    const localDir = path.join(META_ROOT, dest);
    if (!fs.existsSync(localDir)) {
      console.log(`skip missing ${dest}`);
      continue;
    }
    await mkdirp(sftp, `${REMOTE_ROOT}/${dest}`);
    for (const file of FILES) {
      const local = path.join(localDir, file);
      if (!fs.existsSync(local)) continue;
      await upload(sftp, local, `${REMOTE_ROOT}/${dest}/${file}`);
      console.log(`uploaded ${dest}/${file}`);
    }
  }

  await exec(
    conn,
    `curl -s -X POST https://app.unotrips.com/api/public/leads -H "Content-Type: application/json" -H "X-Api-Key: unotrips-meta-lead-2026-secure" -d '{"name":"Meta Sync Test","phone":"9999912345","destination":"Assam","source":"Deploy Smoke Test","captureType":"form"}' || true`
  );

  conn.end();
  console.log('\nMeta CRM ingest sync done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
