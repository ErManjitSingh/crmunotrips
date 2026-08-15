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

/** Display only the human comment for lost reasons — never raw keys like `no_plan`. */
export function formatLostReasonDisplay(statusReason) {
  const raw = String(statusReason || '').trim();
  if (!raw) return '';

  let key = '';
  let comment = '';

  if (/[—–]/.test(raw)) {
    const parts = raw.split(/\s*[—–]\s*/).map((p) => p.trim()).filter(Boolean);
    key = parts[0] || '';
    comment = parts.slice(1).join(' — ').trim();
  } else if (raw.includes(':')) {
    const idx = raw.indexOf(':');
    key = raw.slice(0, idx).trim();
    comment = raw.slice(idx + 1).trim();
  } else if (/\s-\s/.test(raw)) {
    const parts = raw.split(/\s-\s/).map((p) => p.trim()).filter(Boolean);
    key = parts[0] || '';
    comment = parts.slice(1).join(' - ').trim();
  } else {
    key = raw;
  }

  // Prefer free-text comment only (e.g. "NO Plan")
  if (comment) return comment;

  const known = LOST_REASONS.find((r) => r.value === key)?.label;
  if (known) return known;

  // Humanize leftover snake_case keys instead of showing the variable
  if (/^[a-z0-9_]+$/i.test(key)) {
    return key
      .split('_')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }

  return key;
}

/** Build stored lost reason value requiring a free-text comment. */
export function buildLostStatusReason(reasonKey, comment) {
  const key = String(reasonKey || '').trim();
  const note = String(comment || '').trim();
  if (!key || !note) return '';
  return `${key} — ${note}`;
}

export const LEAD_ACCEPT_MINUTES = 30;
