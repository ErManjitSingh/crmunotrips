/** Short labels for lead source — keep in sync with backend leadSources + leadSourceLabels */

export const LEAD_SOURCE_KEYS = [
  'dpw',
  'dpw_wa',
  'dpw2',
  'dpw2_wa',
  'referral',
  'call_lead',
  'organic',
];

const SOURCE_SHORT = {
  dpw: 'DPW',
  dpw_wa: 'DPW WA',
  dpw2: 'DPW2',
  dpw2_wa: 'DPW2 WA',
  referral: 'Referral',
  call_lead: 'Call Lead',
  organic: 'Organic',
  // legacy
  website: 'DPW',
  google_ads: 'DPW',
  facebook_ads: 'DPW2',
  whatsapp: 'DPW2 WA',
  social: 'DPW2',
  phone: 'Call Lead',
  'walk-in': 'Call Lead',
  other: 'Organic',
};

const ALIASES = {
  dpw: 'dpw',
  website: 'dpw',
  google_ads: 'dpw',
  google: 'dpw',
  dpw_wa: 'dpw_wa',
  google_whatsapp: 'dpw_wa',
  dpw2: 'dpw2',
  facebook_ads: 'dpw2',
  facebook: 'dpw2',
  social: 'dpw2',
  instagram: 'dpw2',
  dpw2_wa: 'dpw2_wa',
  whatsapp: 'dpw2_wa',
  wa: 'dpw2_wa',
  facebook_whatsapp: 'dpw2_wa',
  ctwa: 'dpw2_wa',
  referral: 'referral',
  call_lead: 'call_lead',
  phone: 'call_lead',
  call: 'call_lead',
  'walk-in': 'call_lead',
  walk_in: 'call_lead',
  organic: 'organic',
  other: 'organic',
};

function normalizeSourceKey(raw) {
  if (!raw) return '';
  return String(raw)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_');
}

function resolveKey(raw) {
  const key = normalizeSourceKey(raw);
  if (!key) return '';
  if (ALIASES[key]) return ALIASES[key];
  if (LEAD_SOURCE_KEYS.includes(key)) return key;
  const spaced = String(raw).trim().toLowerCase().replace(/\s+/g, ' ');
  if (ALIASES[spaced.replace(/ /g, '_')]) return ALIASES[spaced.replace(/ /g, '_')];
  return '';
}

export function getLeadSourceShortLabel(source, sourceLabel) {
  const explicit = String(sourceLabel || '').trim();
  if (explicit) {
    const fromLabel = resolveKey(explicit);
    if (fromLabel && SOURCE_SHORT[fromLabel]) return SOURCE_SHORT[fromLabel];
    const lower = explicit.toLowerCase();
    if (lower === 'dpw wa' || lower === 'dpw_wa') return 'DPW WA';
    if (lower === 'dpw2 wa' || lower === 'dpw2_wa') return 'DPW2 WA';
    if (lower === 'dpw2') return 'DPW2';
    if (lower === 'dpw') return 'DPW';
    if (lower === 'call lead') return 'Call Lead';
  }

  const key = resolveKey(source);
  if (key && SOURCE_SHORT[key]) return SOURCE_SHORT[key];

  const label = explicit.toLowerCase();
  if (label.includes('dpw2') && (label.includes('wa') || label.includes('whatsapp'))) return 'DPW2 WA';
  if (label.includes('dpw') && (label.includes('wa') || label.includes('whatsapp'))) return 'DPW WA';
  if (label.includes('facebook') || label.includes('instagram')) return 'DPW2';
  if (label.includes('call')) return 'Call Lead';
  if (label.includes('referral')) return 'Referral';
  if (label.includes('organic')) return 'Organic';
  if (label.includes('whatsapp')) return 'DPW WA';
  if (label.includes('dpw2')) return 'DPW2';
  if (label.includes('dpw') || label.includes('google')) return 'DPW';

  return SOURCE_SHORT.organic;
}

export const LEAD_SOURCE_FILTER_OPTIONS = [
  { value: '', label: 'All sources' },
  ...LEAD_SOURCE_KEYS.map((value) => ({ value, label: SOURCE_SHORT[value] })),
];

export { SOURCE_SHORT };
