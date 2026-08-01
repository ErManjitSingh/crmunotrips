/**
 * Remap legacy lead.source values → canonical DPW / DPW WA / DPW2 / DPW2 WA / …
 *   node deploy/backfill-lead-sources.mjs
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

const MAP = {
  website: { source: 'dpw', sourceLabel: 'DPW' },
  google_ads: { source: 'dpw', sourceLabel: 'DPW' },
  facebook_ads: { source: 'dpw2', sourceLabel: 'DPW2' },
  social: { source: 'dpw2', sourceLabel: 'DPW2' },
  whatsapp: { source: 'dpw_wa', sourceLabel: 'DPW WA' },
  phone: { source: 'call_lead', sourceLabel: 'Call Lead' },
  'walk-in': { source: 'call_lead', sourceLabel: 'Call Lead' },
  other: { source: 'organic', sourceLabel: 'Organic' },
};

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI missing');
  await mongoose.connect(uri);
  const Lead = mongoose.connection.collection('leads');

  let total = 0;
  for (const [from, to] of Object.entries(MAP)) {
    const res = await Lead.updateMany(
      { source: from },
      {
        $set: {
          source: to.source,
          sourceLabel: to.sourceLabel,
          leadSource: to.source,
        },
      }
    );
    console.log(`${from} → ${to.source}: ${res.modifiedCount}`);
    total += res.modifiedCount;
  }

  const staleLabels = [
    '',
    'Website',
    'WhatsApp',
    'Phone',
    'Walk-in',
    'Other',
    'Google Ads',
    'Facebook Ads',
    'Social',
    'website',
    'whatsapp',
    'facebook_ads',
    'google_ads',
    'phone',
  ];
  const labelFix = [
    ['dpw', 'DPW'],
    ['dpw_wa', 'DPW WA'],
    ['dpw2', 'DPW2'],
    ['dpw2_wa', 'DPW2 WA'],
    ['referral', 'Referral'],
    ['call_lead', 'Call Lead'],
    ['organic', 'Organic'],
  ];
  for (const [source, sourceLabel] of labelFix) {
    const res = await Lead.updateMany(
      {
        source,
        $or: [{ sourceLabel: { $exists: false } }, { sourceLabel: null }, { sourceLabel: { $in: staleLabels } }],
      },
      { $set: { sourceLabel, leadSource: source } }
    );
    if (res.modifiedCount) console.log(`label ${source}: ${res.modifiedCount}`);
  }

  console.log('BACKFILL_LEAD_SOURCES_OK', { total });
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
