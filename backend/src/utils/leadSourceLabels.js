/** Short display labels for lead source (tables, badges) */
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

function getLeadSourceShortLabel(source, sourceLabel) {
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
  if (label.includes('whatsapp') || label.includes('wa ')) return 'WA';
  if (label.includes('instagram') || label.includes('social')) return 'Social';
  if (label === 'dpw2' || label.includes('dpw2')) return 'DPW2';
  if (label.includes('dpw')) return 'DPW';

  return SOURCE_SHORT.other;
}

module.exports = { SOURCE_SHORT, getLeadSourceShortLabel, normalizeSourceKey };
