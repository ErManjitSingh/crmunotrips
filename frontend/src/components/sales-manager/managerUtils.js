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
  warm: 'bg-amber-50 text-amber-800 ring-amber-200',
  hot: 'bg-rose-50 text-rose-700 ring-rose-200',
  cold: 'bg-slate-50 text-slate-700 ring-slate-200',
  new: 'bg-sky-50 text-sky-700 ring-sky-200',
  contacted: 'bg-amber-50 text-amber-800 ring-amber-200',
  working_progress: 'bg-amber-50 text-amber-800 ring-amber-200',
  follow_up: 'bg-amber-50 text-amber-800 ring-amber-200',
  quotation_sent: 'bg-rose-50 text-rose-700 ring-rose-200',
  negotiation: 'bg-rose-50 text-rose-700 ring-rose-200',
  reactivated: 'bg-amber-50 text-amber-800 ring-amber-200',
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  converted: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  lost: 'bg-slate-50 text-slate-700 ring-slate-200',
  booked_from_another_company: 'bg-slate-50 text-slate-700 ring-slate-200',
};
