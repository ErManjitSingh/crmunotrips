export function formatCurrency(n) {
  if (!n && n !== 0) return '—';
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n.toLocaleString('en-IN')}`;
}

export function formatBudget(n) {
  return formatCurrency(n);
}

export const STATUS_STYLES = {
  new: 'bg-sky-50 text-sky-700 ring-sky-200',
  contacted: 'bg-violet-50 text-violet-700 ring-violet-200',
  working_progress: 'bg-orange-50 text-orange-700 ring-orange-200',
  follow_up: 'bg-amber-50 text-amber-700 ring-amber-200',
  quotation_sent: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  negotiation: 'bg-orange-50 text-orange-700 ring-orange-200',
  reactivated: 'bg-teal-50 text-teal-700 ring-teal-200',
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  converted: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  lost: 'bg-rose-50 text-rose-600 ring-rose-200',
  booked_from_another_company: 'bg-rose-50 text-rose-600 ring-rose-200',
};
