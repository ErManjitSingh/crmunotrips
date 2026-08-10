export const STATUS_FILTERS = [
  { key: '', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'contacted', label: 'Contacted' },
  { key: 'working_progress', label: 'Working' },
  { key: 'qualified', label: 'Qualified' },
  { key: 'follow_up', label: 'Follow-up' },
];

export const LEAD_STATUSES = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'working_progress', label: 'Working' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'quotation_sent', label: 'Quotation' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'converted', label: 'Booking' },
  { value: 'lost', label: 'Lost' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'reactivated', label: 'Reactivated' },
  { value: 'booked_from_another_company', label: 'Booked Elsewhere' },
];

export const MESSAGE_STATUS_ICON = {
  sent: '✓',
  delivered: '✓✓',
  read: '✓✓',
  failed: '!',
};

export const INFO_TABS = [
  { key: 'details', label: 'Details' },
  { key: 'travel', label: 'Travel' },
  { key: 'notes', label: 'Notes' },
  { key: 'activity', label: 'Activity' },
  { key: 'files', label: 'Files' },
];
