/**
 * Retag WhatsApp leads that were force-labeled DPW2 WA but have no Meta CTWA referral
 * → DPW WA (Google Ads WhatsApp).
 *
 *   node deploy/retag-whatsapp-google-source.mjs
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

function isRealMetaConversation(conv = {}) {
  const meta = conv.inboundAdMeta || {};
  const url = String(meta.sourceUrl || meta.source_url || '').toLowerCase();
  const ctwa = String(meta.ctwaClid || meta.ctwa_clid || '').trim();
  if (ctwa) return true;
  if (/facebook|fb\.me|fb\.com|instagram|meta\.com|ig\.me/i.test(url)) return true;
  return false;
}

function toId(value) {
  if (!value) return null;
  try {
    return new mongoose.Types.ObjectId(String(value));
  } catch {
    return null;
  }
}

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI missing');
  await mongoose.connect(uri);
  const Lead = mongoose.connection.collection('leads');
  const Conv = mongoose.connection.collection('whatsappconversations');

  const convs = await Conv.find({ lead: { $ne: null } }).toArray();
  const metaLeadIds = new Set();
  const googleLeadIds = new Set();

  for (const c of convs) {
    const id = String(c.lead);
    if (isRealMetaConversation(c)) metaLeadIds.add(id);
    else googleLeadIds.add(id);
  }

  const onlyGoogle = [...googleLeadIds].filter((id) => !metaLeadIds.has(id));
  const googleOids = onlyGoogle.map(toId).filter(Boolean);

  const before = await Lead.countDocuments({
    _id: { $in: googleOids },
    source: 'dpw2_wa',
    deletedAt: null,
  });

  const res = await Lead.updateMany(
    {
      _id: { $in: googleOids },
      source: { $in: ['dpw2_wa', 'whatsapp'] },
      deletedAt: null,
    },
    {
      $set: {
        source: 'dpw_wa',
        sourceLabel: 'DPW WA',
        leadSource: 'dpw_wa',
      },
    }
  );

  // Any remaining channel=whatsapp / captureType whatsapp dpw2_wa without Meta lead id
  const metaOids = [...metaLeadIds].map(toId).filter(Boolean);
  const orphan = await Lead.updateMany(
    {
      deletedAt: null,
      source: 'dpw2_wa',
      _id: { $nin: metaOids },
      $or: [
        { channel: 'whatsapp' },
        { captureType: { $in: ['whatsapp_chat', 'whatsapp_google', 'whatsapp_ctwa'] } },
        { sourceLabel: { $in: ['DPW2 WA', 'WhatsApp', 'whatsapp'] } },
      ],
    },
    {
      $set: {
        source: 'dpw_wa',
        sourceLabel: 'DPW WA',
        leadSource: 'dpw_wa',
      },
    }
  );

  console.log('RETAG_WHATSAPP_GOOGLE_OK', {
    conversations: convs.length,
    metaLeads: metaLeadIds.size,
    googleOnlyLeads: onlyGoogle.length,
    matchedDpw2Before: before,
    retaggedFromConv: res.modifiedCount,
    retaggedOrphan: orphan.modifiedCount,
  });
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
