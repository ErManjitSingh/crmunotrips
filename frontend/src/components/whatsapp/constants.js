/** WhatsApp list filters — Warm / Hot / Cold only */
export const STATUS_FILTERS = [
  { key: '', label: 'All' },
  { key: 'warm', label: 'Warm' },
  { key: 'hot', label: 'Hot' },
  { key: 'cold', label: 'Cold' },
];

/** @deprecated Use Warm/Hot/Cold outcomes via leadTemperatureStatus */
export const LEAD_STATUSES = [
  { value: 'warm', label: 'Warm' },
  { value: 'hot', label: 'Hot' },
  { value: 'cold', label: 'Cold' },
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
