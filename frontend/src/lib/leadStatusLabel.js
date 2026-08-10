/**
 * Canonical lead status labels — Contacted ≠ Qualified (answering ≠ genuine buyer).
 * Pipeline: New → Contacted → Working → Qualified → Quotation → Follow-up → Booking | Lost
 */
const STATUS_LABELS = {
  new: 'New',
  contacted: 'Contacted',
  working_progress: 'Working',
  qualified: 'Qualified',
  quotation_sent: 'Quotation',
  follow_up: 'Follow-up',
  negotiation: 'Negotiation',
  reactivated: 'Reactivated',
  converted: 'Booking',
  lost: 'Lost',
  booked_from_another_company: 'Booked Elsewhere',
};

const STATUS_MEANINGS = {
  new: 'Lead just received',
  contacted: 'Executive has spoken / message exchanged',
  working_progress: 'Customer is interested but requirements aren’t confirmed',
  qualified: 'Genuine buyer + requirements confirmed',
  quotation_sent: 'Price / package sent',
  follow_up: 'Waiting for customer decision',
  converted: 'Customer has confirmed / paid',
  lost: 'Not converting / rejected',
};

export function getLeadStatusLabel(status) {
  if (!status) return '—';
  return STATUS_LABELS[status] || String(status).replace(/_/g, ' ');
}

export function getLeadStatusMeaning(status) {
  if (!status) return '';
  return STATUS_MEANINGS[status] || '';
}

export { STATUS_LABELS, STATUS_MEANINGS };
