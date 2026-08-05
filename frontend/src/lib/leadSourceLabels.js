/** Short labels for lead source — keep in sync with backend leadSources + leadSourceLabels */

export const LEAD_SOURCE_KEYS = [
  'dpw',
  'dpw_wa',
  'dpw_call',
  'dpw2',
  'dpw2_wa',
  'dpw2_call',
  'referral',
  'call_lead',
  'organic',
];

const SOURCE_SHORT = {
  dpw: 'DPW',
  dpw_wa: 'DPW WA',
  dpw_call: 'DPW CALL',
  dpw2: 'DPW2',
  dpw2_wa: 'DPW2 WA',
  dpw2_call: 'DPW2 CALL',
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
  dpw_call: 'dpw_call',
  'dpw call': 'dpw_call',
  google_call: 'dpw_call',
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
  dpw2_call: 'dpw2_call',
  'dpw2 call': 'dpw2_call',
  facebook_call: 'dpw2_call',
  fb_call: 'dpw2_call',
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
  if (ALIASES[spaced]) return ALIASES[spaced];
  if (ALIASES[spaced.replace(/ /g, '_')]) return ALIASES[spaced.replace(/ /g, '_')];
  return '';
}

/** Canonical source key (dpw, dpw_wa, call_lead, …) or '' */
export function resolveLeadSourceKey(source, sourceLabel) {
  return resolveKey(sourceLabel) || resolveKey(source) || '';
}

/**
 * Channel for UI icons: whatsapp | call | form | other
 * Form covers website / Meta lead-form (DPW, DPW2) — not Facebook brand.
 */
export function getLeadSourceChannel(source, sourceLabel) {
  const key = resolveLeadSourceKey(source, sourceLabel);
  if (key === 'dpw_wa' || key === 'dpw2_wa') return 'whatsapp';
  if (key === 'dpw_call' || key === 'dpw2_call' || key === 'call_lead') return 'call';
  if (key === 'dpw' || key === 'dpw2') return 'form';

  const blob = `${source || ''} ${sourceLabel || ''}`.toLowerCase();
  if (/(^|[\s_])wa([\s_]|$)|whatsapp|ctwa/.test(blob)) return 'whatsapp';
  if (/\bcall\b|phone|walk[\s_-]?in/.test(blob)) return 'call';
  if (/facebook|instagram|fb[\s_-]?lead|lead[\s_-]?form|form|website|google/.test(blob)) {
    return 'form';
  }
  return 'other';
}

export function getLeadSourceShortLabel(source, sourceLabel) {
  const explicit = String(sourceLabel || '').trim();
  if (explicit) {
    const fromLabel = resolveKey(explicit);
    if (fromLabel && SOURCE_SHORT[fromLabel]) return SOURCE_SHORT[fromLabel];
    const lower = explicit.toLowerCase();
    if (lower === 'dpw call' || lower === 'dpw_call') return 'DPW CALL';
    if (lower === 'dpw2 call' || lower === 'dpw2_call') return 'DPW2 CALL';
    if (lower === 'dpw wa' || lower === 'dpw_wa') return 'DPW WA';
    if (lower === 'dpw2 wa' || lower === 'dpw2_wa') return 'DPW2 WA';
    if (lower === 'dpw2') return 'DPW2';
    if (lower === 'dpw') return 'DPW';
    if (lower === 'call lead') return 'Call Lead';
  }

  const key = resolveKey(source);
  if (key && SOURCE_SHORT[key]) return SOURCE_SHORT[key];

  const label = explicit.toLowerCase();
  if (label.includes('dpw2') && label.includes('call')) return 'DPW2 CALL';
  if (label.includes('dpw') && label.includes('call') && !label.includes('wa')) return 'DPW CALL';
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
