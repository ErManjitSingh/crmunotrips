export const STATUS_FILTERS = [
  { key: '', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'working_progress', label: 'Working Progress' },
  { key: 'follow_up', label: 'Follow Up' },
];

export const LEAD_STATUSES = [
  { value: 'new', label: 'New Lead' },
  { value: 'contacted', label: 'Connected' },
  { value: 'working_progress', label: 'Working Progress' },
  { value: 'follow_up', label: 'Follow Up' },
  { value: 'quotation_sent', label: 'Quotation Sent' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'reactivated', label: 'Reactivated' },
  { value: 'converted', label: 'Converted' },
  { value: 'lost', label: 'Lost' },
  { value: 'booked_from_another_company', label: 'Booked From Another Company' },
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
