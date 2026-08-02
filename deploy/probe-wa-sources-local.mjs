/**
 * Run on VPS: node deploy/probe-wa-sources-local.mjs
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = existsSync('/var/www/app-unotrips-crm/backend/package.json')
  ? '/var/www/app-unotrips-crm/backend'
  : resolve(__dirname, '../backend');
const require = createRequire(resolve(backendRoot, 'package.json'));
const mongoose = require('mongoose');

function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    const key = m[1].trim();
    let val = m[2].trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv(resolve(backendRoot, '.env'));

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const Lead = mongoose.connection.collection('leads');
  const Conv = mongoose.connection.collection('whatsappconversations');

  const bySource = await Lead.aggregate([
    { $match: { deletedAt: null, source: { $in: ['dpw_wa', 'dpw2_wa', 'whatsapp', 'dpw', 'dpw2'] } } },
    { $group: { _id: '$source', n: { $sum: 1 } } },
    { $sort: { n: -1 } },
  ]).toArray();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayBySource = await Lead.aggregate([
    {
      $match: {
        deletedAt: null,
        createdAt: { $gte: today },
        source: { $in: ['dpw_wa', 'dpw2_wa', 'whatsapp'] },
      },
    },
    { $group: { _id: '$source', n: { $sum: 1 } } },
  ]).toArray();

  const convByAd = await Conv.aggregate([
    { $group: { _id: '$inboundAdSource', n: { $sum: 1 } } },
    { $sort: { n: -1 } },
  ]).toArray();

  const linked = await Conv.find({ lead: { $ne: null } })
    .project({ lead: 1, inboundAdSource: 1, inboundAdMeta: 1 })
    .toArray();
  const leads = await Lead.find({ _id: { $in: linked.map((c) => c.lead) } })
    .project({ source: 1, channel: 1 })
    .toArray();
  const map = Object.fromEntries(leads.map((l) => [String(l._id), l]));

  const stats = {
    realMeta: 0,
    fakeMetaFlag: 0,
    emptyAd: 0,
    fakeMetaStillDpw2: 0,
    emptyStillDpw2: 0,
    alreadyDpwWa: 0,
  };

  for (const c of linked) {
    const src = map[String(c.lead)]?.source || '?';
    const inbound = String(c.inboundAdSource || '');
    const url = String(c.inboundAdMeta?.sourceUrl || '').toLowerCase();
    const ctwa = String(c.inboundAdMeta?.ctwaClid || c.inboundAdMeta?.ctwa_clid || '');
    const realMeta = Boolean(ctwa) || /facebook|fb\.me|fb\.com|instagram|meta\.com|ig\.me/.test(url);
    if (src === 'dpw_wa') stats.alreadyDpwWa += 1;
    if (realMeta) stats.realMeta += 1;
    else if (inbound === 'facebook_ad') {
      stats.fakeMetaFlag += 1;
      if (src === 'dpw2_wa') stats.fakeMetaStillDpw2 += 1;
    } else {
      stats.emptyAd += 1;
      if (src === 'dpw2_wa') stats.emptyStillDpw2 += 1;
    }
  }

  console.log(JSON.stringify({ bySource, todayBySource, convByAd, stats, linked: linked.length }, null, 2));
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
