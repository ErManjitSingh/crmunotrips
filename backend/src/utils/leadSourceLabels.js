const {
  LEAD_SOURCE_KEYS,
  LEAD_SOURCE_LABELS,
  LEAD_SOURCE_ALIASES,
  resolveLeadSourceKey,
  leadSourceLabel,
  normalizeLeadSourceKey,
} = require('../constants/leadSources');

/** Short display labels for lead source (tables, badges) */
const SOURCE_SHORT = { ...LEAD_SOURCE_LABELS };

function getLeadSourceShortLabel(source, sourceLabel) {
  const explicit = String(sourceLabel || '').trim();
  if (explicit) {
    const resolvedFromLabel = resolveLeadSourceKey(explicit, '');
    if (resolvedFromLabel && LEAD_SOURCE_KEYS.includes(resolvedFromLabel)) {
      return LEAD_SOURCE_LABELS[resolvedFromLabel];
    }
    const lower = explicit.toLowerCase();
    if (lower === 'dpw wa' || lower === 'dpw_wa') return 'DPW WA';
    if (lower === 'dpw2 wa' || lower === 'dpw2_wa') return 'DPW2 WA';
    if (lower === 'dpw2') return 'DPW2';
    if (lower === 'dpw') return 'DPW';
    if (lower === 'call lead' || lower === 'call_lead') return 'Call Lead';
  }

  const key = resolveLeadSourceKey(source || '', '');
  if (key && SOURCE_SHORT[key]) return SOURCE_SHORT[key];

  const label = explicit.toLowerCase();
  if (label.includes('dpw2') && (label.includes('wa') || label.includes('whatsapp'))) return 'DPW2 WA';
  if (label.includes('dpw') && (label.includes('wa') || label.includes('whatsapp'))) return 'DPW WA';
  if (label.includes('facebook') || label.includes('instagram') || label.includes('fb ')) return 'DPW2';
  if (label.includes('google') && !label.includes('whatsapp')) return 'DPW';
  if (label.includes('call')) return 'Call Lead';
  if (label.includes('referral')) return 'Referral';
  if (label.includes('organic')) return 'Organic';
  if (label.includes('whatsapp') || label.includes('wa ')) return 'DPW WA';
  if (label.includes('dpw2')) return 'DPW2';
  if (label.includes('dpw')) return 'DPW';

  return SOURCE_SHORT.organic;
}

module.exports = {
  SOURCE_SHORT,
  getLeadSourceShortLabel,
  normalizeSourceKey: normalizeLeadSourceKey,
  LEAD_SOURCE_ALIASES,
  leadSourceLabel,
};
