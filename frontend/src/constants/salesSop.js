/** Mirrors backend/src/constants/salesSop.js — keep labels in sync */

export const LOST_REASONS = [
  { value: 'too_expensive', label: 'Too Expensive' },
  { value: 'not_travelling', label: 'Not Travelling' },
  { value: 'booked_elsewhere', label: 'Booked Elsewhere' },
  { value: 'no_response', label: 'No Response' },
  { value: 'date_changed', label: 'Date Changed' },
  { value: 'budget_issue', label: 'Budget Issue / Costing Issue' },
  { value: 'destination_changed', label: 'Destination Changed' },
  { value: 'duplicate_lead', label: 'Duplicate Lead' },
  { value: 'invalid_number', label: 'Invalid number / wrong' },
  { value: 'lost_contacted', label: 'Lost contacted' },
  { value: 'does_not_exist', label: 'Does not exist' },
];

export const LEAD_ACCEPT_MINUTES = 30;
