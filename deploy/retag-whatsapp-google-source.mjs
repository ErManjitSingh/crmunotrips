/**
 * Retag WhatsApp leads that were force-labeled DPW2 WA but have no Meta CTWA referral
 * → DPW WA (Google Ads WhatsApp).
 *
 * Keeps DPW2 WA when conversation has facebook_ad / ctwa / fb|instagram|meta URL.
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

function isMetaConversation(conv = {}) {
  const meta = conv.inboundAdMeta || {};
  const url = String(meta.sourceUrl || meta.source_url || '').toLowerCase();
  const ctwa = String(meta.ctwaClid || meta.ctwa_clid || '').trim();
  // Require real Meta CTWA signal — do not trust bare inboundAdSource alone
  if (ctwa) return true;
  if (/facebook|fb\.me|fb\.com|instagram|meta\.com|ig\.me/i.test(url)) return true;
  return false;
}

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI missing');
  await mongoose.connect(uri);
  const Lead = mongoose.connection.collection('leads');
  const Conv = mongoose.connection.collection('whatsappconversations');

  const convs = await Conv.find(
    { lead: { $ne: null } },
    { projection: { lead: 1, inboundAdSource: 1, inboundAdMeta: 1, phone: 1 } }
  ).toArray();

  const metaLeadIds = new Set();
  const nonMetaLeadIds = new Set();
  for (const c of convs) {
    const id = String(c.lead);
    if (isMetaConversation(c)) metaLeadIds.add(id);
    else nonMetaLeadIds.add(id);
  }

  // Non-meta wins only when no meta signal on any conversation for that lead
  const toGoogle = [...nonMetaLeadIds].filter((id) => !metaLeadIds.has(id));

  let modified = 0;
  if (toGoogle.length) {
    const objectIds = toGoogle
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    const res = await Lead.updateMany(
      {
        _id: { $in: objectIds },
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
    modified = res.modifiedCount;
  }

  // Also: channel whatsapp + dpw2_wa with no linked meta conversation (orphans already covered)
  // channel whatsapp leads tagged dpw2_wa that have zero conversations stay as-is unless channel-only
  const orphan = await Lead.updateMany(
    {
      channel: 'whatsapp',
      source: 'dpw2_wa',
      deletedAt: null,
      _id: {
        $nin: [...metaLeadIds]
          .filter((id) => mongoose.Types.ObjectId.isValid(id))
          .map((id) => new mongoose.Types.ObjectId(id)),
      },
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
    retaggedFromConv: modified,
    retaggedOrphanChannel: orphan.modifiedCount,
  });
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
