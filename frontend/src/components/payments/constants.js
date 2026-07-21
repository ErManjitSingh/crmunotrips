export const PAYMENT_STATUSES = [
  { value: 'paid', label: 'Received', color: 'bg-emerald-500', soft: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'pending', label: 'Pending', color: 'bg-amber-500', soft: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'partial', label: 'Partial', color: 'bg-sky-500', soft: 'bg-sky-50 text-sky-700 border-sky-200' },
  { value: 'refunded', label: 'Refunded', color: 'bg-violet-500', soft: 'bg-violet-50 text-violet-700 border-violet-200' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-slate-400', soft: 'bg-slate-100 text-slate-600 border-slate-200' },
  { value: 'failed', label: 'Failed', color: 'bg-red-500', soft: 'bg-red-50 text-red-700 border-red-200' },
];

export const PAYMENT_METHODS = [
  { value: 'upi', label: 'UPI', color: '#8B5CF6' },
  { value: 'card', label: 'Card', color: '#3B82F6' },
  { value: 'bank_transfer', label: 'Bank Transfer', color: '#14B8A6' },
  { value: 'cash', label: 'Cash', color: '#F59E0B' },
  { value: 'cheque', label: 'Cheque', color: '#64748B' },
];

export const DATE_PRESETS = [
  { value: '', label: 'All' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last7', label: 'Last 7 Days' },
  { value: 'month', label: 'This Month' },
  { value: 'lastMonth', label: 'Last Month' },
  { value: 'last6', label: 'Last 6 Months' },
];

export const MONTHLY_TARGET = 10_000_000;

export const EMPTY_FILTERS = {
  search: '',
  datePreset: '',
  status: '',
  method: '',
  destination: '',
  amountMin: '',
  amountMax: '',
  dateFrom: '',
  dateTo: '',
  gateway: '',
  executive: '',
  branch: '',
};

export const STATUS_MAP = Object.fromEntries(PAYMENT_STATUSES.map((s) => [s.value, s]));
export const METHOD_MAP = Object.fromEntries(PAYMENT_METHODS.map((m) => [m.value, m]));
