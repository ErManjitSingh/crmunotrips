/**
 * Sales Executive — Warm / Hot / Cold outcome list for filters & status set.
 */
import { WARM_OUTCOMES, HOT_OUTCOMES, COLD_OUTCOMES } from '../components/followups/constants';

export const LEAD_FOLLOW_UP_OUTCOMES = [
  ...WARM_OUTCOMES.map((o) => ({
    ...o,
    status: o.value === 'cnp_same_day' ? 'follow_up' : 'contacted',
    temperature: 'warm',
  })),
  ...HOT_OUTCOMES.map((o) => ({ ...o, status: 'negotiation', temperature: 'hot' })),
  ...COLD_OUTCOMES.map((o) => ({
    ...o,
    status: 'follow_up',
    temperature: 'cold',
  })),
];

export function getFollowUpOutcome(value) {
  return LEAD_FOLLOW_UP_OUTCOMES.find((o) => o.value === value) || null;
}

export function resolveOutcomeFromLead(lead) {
  if (!lead) return '';
  const reason = String(lead.statusReason || '').trim();
  const head = reason.split(/\s*[—–]\s*|\s+-\s+/)[0]?.trim() || reason;
  if (head && LEAD_FOLLOW_UP_OUTCOMES.some((o) => o.value === head)) {
    return LEAD_FOLLOW_UP_OUTCOMES.find((o) => o.value === head).value;
  }
  return '';
}
