const STATUS_LABELS = {
  new: 'New Lead',
  contacted: 'Connected',
  working_progress: 'Working Progress',
  follow_up: 'Follow Up',
  quotation_sent: 'Quotation Sent',
  negotiation: 'Negotiation',
  reactivated: 'Reactivated',
  converted: 'Converted',
  lost: 'Lost',
  booked_from_another_company: 'Booked From Another Company',
};

export function getLeadStatusLabel(status) {
  if (!status) return '—';
  return STATUS_LABELS[status] || status.replace(/_/g, ' ');
}
