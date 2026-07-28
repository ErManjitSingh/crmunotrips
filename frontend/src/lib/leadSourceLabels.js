/** Short labels for lead source — keep in sync with backend/src/utils/leadSourceLabels.js */
const SOURCE_SHORT = {
  google_ads: 'Website',
  facebook_ads: 'DPW2',
  facebook: 'DPW2',
  website: 'DPW',
  whatsapp: 'WA',
  referral: 'Referral',
  social: 'Social',
  phone: 'Phone',
  'walk-in': 'Walk-in',
  organic: 'Organic',
  other: 'Other',
};

function normalizeSourceKey(raw) {
  if (!raw) return '';
  return String(raw)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_');
}

export function getLeadSourceShortLabel(source, sourceLabel) {
  const explicit = String(sourceLabel || '').trim();
  if (explicit) {
    const lower = explicit.toLowerCase();
    if (lower === 'dpw') return 'DPW';
    if (lower === 'dpw2') return 'DPW2';
  }

  const key = normalizeSourceKey(source);
  if (SOURCE_SHORT[key]) return SOURCE_SHORT[key];

  const label = explicit.toLowerCase();
  if (label.includes('facebook') || label.includes('fb ')) return 'DPW2';
  if (label.includes('google')) return 'Website';
  if (label.includes('whatsapp')) return 'WA';
  if (label.includes('instagram') || label.includes('social')) return 'Social';
  if (label === 'dpw2' || label.includes('dpw2')) return 'DPW2';
  if (label.includes('dpw')) return 'DPW';

  return SOURCE_SHORT.other;
}

export const LEAD_SOURCE_FILTER_OPTIONS = [
  { value: '', label: 'All sources' },
  { value: 'google_ads', label: 'Website' },
  { value: 'facebook_ads', label: 'DPW2' },
  { value: 'website', label: 'DPW' },
  { value: 'whatsapp', label: 'WA' },
  { value: 'referral', label: 'Referral' },
  { value: 'phone', label: 'Phone' },
  { value: 'walk-in', label: 'Walk-in' },
];
