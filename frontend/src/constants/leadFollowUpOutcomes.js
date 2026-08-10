/**
 * Sales Executive — single "Lead follow up" outcome list.
 * Each option maps to a lead status + statusReason stored on the lead.
 */
export const LEAD_FOLLOW_UP_OUTCOMES = [
  { value: 'just_inquiring', label: 'Just inquiring / Just information', status: 'follow_up' },
  { value: 'wants_group_tour', label: 'Wants to group tour', status: 'follow_up' },
  { value: 'language_barrier', label: 'Language barrier', status: 'follow_up' },
  { value: 'invalid_number', label: 'Invalid number / wrong', status: 'lost', lostReason: 'invalid_number' },
  { value: 'unknown_destination', label: 'Unknown destination', status: 'follow_up' },
  { value: 'no_plan', label: 'No plan', status: 'follow_up' },
  { value: 'lost_contacted', label: 'Lost contacted', status: 'lost', lostReason: 'lost_contacted' },
  { value: 'working_progress', label: 'Working', status: 'working_progress' },
  { value: 'qualified', label: 'Qualified (requirements confirmed)', status: 'qualified' },
  { value: 'converted', label: 'Booking', status: 'converted' },
  {
    value: 'quotation_booked_elsewhere',
    label: 'Quotation send / booked from other company',
    status: 'booked_from_another_company',
    lostReason: 'booked_elsewhere',
  },
  { value: 'budget_issues', label: 'Budget issues / Costing issue', status: 'follow_up' },
  { value: 'destination_change', label: 'Destination change', status: 'follow_up' },
  { value: 'switch_off', label: 'Switch off', status: 'follow_up' },
  { value: 'not_reachable', label: 'Not reachable', status: 'follow_up' },
  { value: 'not_answering', label: 'Not answering', status: 'follow_up' },
  { value: 'does_not_exist', label: 'Does not exist', status: 'lost', lostReason: 'does_not_exist' },
];

export function getFollowUpOutcome(value) {
  return LEAD_FOLLOW_UP_OUTCOMES.find((o) => o.value === value) || null;
}

export function resolveOutcomeFromLead(lead) {
  if (!lead) return '';
  if (lead.status === 'converted') return 'converted';
  if (lead.status === 'working_progress') return 'working_progress';
  if (lead.status === 'qualified') return 'qualified';
  if (lead.status === 'booked_from_another_company') return 'quotation_booked_elsewhere';
  const reason = String(lead.statusReason || '').trim();
  if (reason && LEAD_FOLLOW_UP_OUTCOMES.some((o) => o.value === reason || o.lostReason === reason)) {
    const byValue = LEAD_FOLLOW_UP_OUTCOMES.find((o) => o.value === reason);
    if (byValue) return byValue.value;
    const byLost = LEAD_FOLLOW_UP_OUTCOMES.find((o) => o.lostReason === reason);
    if (byLost) return byLost.value;
  }
  return '';
}
