/** Static fallback Warm / Hot / Cold / Converted options (also seeded in DB). */

export const DEFAULT_WARM_OUTCOMES = [
  { value: 'discussed_package', label: 'Package discussed' },
  { value: 'requested_callback', label: 'Request call back' },
  { value: 'cnp_same_day', label: 'CNP for same day' },
  { value: 'price_negotiation', label: 'Price negotiation going on' },
];

export const DEFAULT_HOT_OUTCOMES = [
  { value: 'ready_to_book', label: 'Ready to Book' },
];

export const DEFAULT_COLD_OUTCOMES = [
  { value: 'booked_elsewhere', label: 'Booked from another company' },
  { value: 'language_barrier', label: 'Language barrier' },
  { value: 'not_interested', label: 'Not interested' },
  { value: 'invalid_number', label: 'Invalid no' },
  { value: 'budget_issues', label: 'Budget issues' },
];

export const DEFAULT_CONVERTED_OUTCOMES = [
  { value: 'converted', label: 'Converted' },
];
