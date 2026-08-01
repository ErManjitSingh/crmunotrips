/**
 * Canonical lead sources — keep FE/BE labels in sync via leadSourceLabels.
 */
const LEAD_SOURCE_KEYS = [
  'dpw',
  'dpw_wa',
  'dpw2',
  'dpw2_wa',
  'referral',
  'call_lead',
  'organic',
];

/** Legacy keys still stored on old rows / accepted on write for migration */
const LEGACY_LEAD_SOURCE_KEYS = [
  'website',
  'google_ads',
  'facebook_ads',
  'whatsapp',
  'social',
  'phone',
  'walk-in',
  'other',
];

const LEAD_SOURCE_ENUM = [...LEAD_SOURCE_KEYS, ...LEGACY_LEAD_SOURCE_KEYS];

const LEAD_SOURCE_LABELS = {
  dpw: 'DPW',
  dpw_wa: 'DPW WA',
  dpw2: 'DPW2',
  dpw2_wa: 'DPW2 WA',
  referral: 'Referral',
  call_lead: 'Call Lead',
  organic: 'Organic',
  // legacy → display (until backfilled)
  website: 'DPW',
  google_ads: 'DPW',
  facebook_ads: 'DPW2',
  whatsapp: 'DPW2 WA',
  social: 'DPW2',
  phone: 'Call Lead',
  'walk-in': 'Call Lead',
  other: 'Organic',
};

/** Map any wizard / ingest / legacy value → canonical storage key */
const LEAD_SOURCE_ALIASES = {
  dpw: 'dpw',
  website: 'dpw',
  google_ads: 'dpw',
  google: 'dpw',
  'google ads': 'dpw',

  dpw_wa: 'dpw_wa',
  'dpw wa': 'dpw_wa',
  google_whatsapp: 'dpw_wa',
  landing_whatsapp: 'dpw_wa',

  dpw2: 'dpw2',
  facebook_ads: 'dpw2',
  facebook: 'dpw2',
  fb: 'dpw2',
  social: 'dpw2',
  instagram: 'dpw2',
  ig: 'dpw2',

  dpw2_wa: 'dpw2_wa',
  'dpw2 wa': 'dpw2_wa',
  whatsapp: 'dpw2_wa',
  wa: 'dpw2_wa',
  facebook_whatsapp: 'dpw2_wa',
  fb_wa: 'dpw2_wa',
  fb_whatsapp: 'dpw2_wa',
  ctwa: 'dpw2_wa',
  meta_whatsapp: 'dpw2_wa',

  referral: 'referral',

  call_lead: 'call_lead',
  phone: 'call_lead',
  call: 'call_lead',
  'call lead': 'call_lead',
  'walk-in': 'call_lead',
  walk_in: 'call_lead',
  walkin: 'call_lead',

  organic: 'organic',
  other: 'organic',
};

function normalizeLeadSourceKey(raw) {
  if (raw == null || raw === '') return '';
  return String(raw)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/__+/g, '_');
}

function resolveLeadSourceKey(raw, fallback = 'dpw') {
  const key = normalizeLeadSourceKey(raw);
  if (!key) return fallback;
  if (LEAD_SOURCE_ALIASES[key]) return LEAD_SOURCE_ALIASES[key];
  // spaced labels like "DPW WA"
  const spaced = String(raw).trim().toLowerCase().replace(/\s+/g, ' ');
  if (LEAD_SOURCE_ALIASES[spaced]) return LEAD_SOURCE_ALIASES[spaced];
  if (LEAD_SOURCE_KEYS.includes(key)) return key;
  return fallback;
}

function leadSourceLabel(key) {
  const resolved = resolveLeadSourceKey(key, key);
  return LEAD_SOURCE_LABELS[resolved] || LEAD_SOURCE_LABELS[key] || 'DPW';
}

/** Options for add-lead forms / filters */
const LEAD_SOURCE_OPTIONS = LEAD_SOURCE_KEYS.map((value) => ({
  value,
  label: LEAD_SOURCE_LABELS[value],
}));

module.exports = {
  LEAD_SOURCE_KEYS,
  LEGACY_LEAD_SOURCE_KEYS,
  LEAD_SOURCE_ENUM,
  LEAD_SOURCE_LABELS,
  LEAD_SOURCE_ALIASES,
  LEAD_SOURCE_OPTIONS,
  normalizeLeadSourceKey,
  resolveLeadSourceKey,
  leadSourceLabel,
};
