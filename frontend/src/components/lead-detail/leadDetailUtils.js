const SOURCE_LABELS = {
  dpw: 'DPW',
  dpw_wa: 'DPW WA',
  dpw2: 'DPW2',
  dpw2_wa: 'DPW2 WA',
  referral: 'Referral',
  call_lead: 'Call Lead',
  organic: 'Organic',
  website: 'DPW',
  whatsapp: 'DPW WA',
  'walk-in': 'Call Lead',
  social: 'DPW2',
  phone: 'Call Lead',
  other: 'Organic',
  google_ads: 'DPW',
  facebook_ads: 'DPW2',
  DPW: 'DPW',
  'DPW WA': 'DPW WA',
  DPW2: 'DPW2',
  'DPW2 WA': 'DPW2 WA',
  'Facebook Lead': 'DPW2',
};

export function getInitials(name) {
  return (
    name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'LD'
  );
}

export function formatSource(lead) {
  const raw = lead?.sourceLabel || lead?.leadSource || lead?.source || 'Website';
  return SOURCE_LABELS[raw] || String(raw).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function computeLeadAge(createdAt) {
  if (!createdAt) return '—';
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return '1 day';
  return `${days} days`;
}

export function computeLeadScores(lead) {
  const smart = Number(lead?.smartScore) || 0;
  const response = Number(lead?.responseRate) || 0;
  const budget = Number(lead?.budget) || 0;
  const budgetScore = budget >= 70000 ? 90 : budget >= 50000 ? 80 : budget >= 30000 ? 70 : budget >= 15000 ? 55 : 40;
  const fuCount = lead?.followups?.length || lead?.followUps?.length || 0;
  const quoteCount = lead?.quotations?.length || 0;
  const engagementScore = Math.min(100, fuCount * 12 + quoteCount * 18 + (lead?.lastContactedAt ? 25 : 10));
  const responseScore = response || Math.min(90, engagementScore + 10);
  const statusMap = {
    converted: 100,
    negotiation: 72,
    quotation_sent: 65,
    follow_up: 55,
    contacted: 40,
    new: 25,
  };
  const conversionProbability = statusMap[lead?.status] ?? (smart || 50);
  const overall = smart || Math.round((budgetScore + engagementScore + responseScore + conversionProbability) / 4);

  return { overall, budgetScore, engagementScore, responseScore, conversionProbability };
}

export function deriveLeadTags(lead) {
  const tags = [];
  if (lead?.destination) tags.push(lead.destination.split(',')[0].trim());
  if (lead?.hotelCategory) tags.push(lead.hotelCategory);
  if (lead?.isHot || lead?.temperature === 'hot') tags.push('Hot');
  if (lead?.mealPreference) tags.push(lead.mealPreference);
  if (lead?.leadType === 'family' || (lead?.children > 0)) tags.push('Family');
  return [...new Set(tags)].slice(0, 6);
}

export function getUpcomingFollowUp(followups = []) {
  const pending = followups
    .filter((f) => f.status === 'pending' && f.scheduledAt)
    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
  return pending[0] || null;
}

export const DETAIL_CARD = 'rounded-2xl border border-slate-200/80 dark:border-slate-700/60 bg-white dark:bg-slate-900 shadow-sm';
