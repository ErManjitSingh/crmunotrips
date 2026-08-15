/** Mirrors backend/src/constants/salesSop.js — keep labels in sync */

export const LOST_REASONS = [
  { value: 'too_expensive', label: 'Too Expensive' },
  { value: 'not_travelling', label: 'Not Travelling' },
  { value: 'booked_elsewhere', label: 'Booked Elsewhere' },
  { value: 'no_response', label: 'No Response' },
  { value: 'date_changed', label: 'Date Changed' },
  { value: 'budget_issue', label: 'Budget Issue / Costing Issue' },
  { value: 'destination_changed', label: 'Destination Changed' },
  { value: 'duplicate_lead', label: 'Repeated Lead' },
  { value: 'invalid_number', label: 'Invalid number / wrong' },
  { value: 'lost_contacted', label: 'Lost contacted' },
  { value: 'does_not_exist', label: 'Does not exist' },
];

/** Display label for stored statusReason (`key` or `key — comment`). */
export function formatLostReasonDisplay(statusReason) {
  const raw = String(statusReason || '').trim();
  if (!raw) return '';
  const parts = raw.split(/\s*[—–]\s*/).map((p) => p.trim()).filter(Boolean);
  const key = parts[0] || '';
  const comment = parts.slice(1).join(' — ').trim();
  const label = LOST_REASONS.find((r) => r.value === key)?.label || key;
  return comment ? `${label}: ${comment}` : label;
}

/** Build stored lost reason value requiring a free-text comment. */
export function buildLostStatusReason(reasonKey, comment) {
  const key = String(reasonKey || '').trim();
  const note = String(comment || '').trim();
  if (!key || !note) return '';
  return `${key} — ${note}`;
}

export const LEAD_ACCEPT_MINUTES = 30;
