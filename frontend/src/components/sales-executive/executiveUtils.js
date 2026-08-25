export { formatBudget, formatCurrency, STATUS_STYLES } from '../sales-manager/managerUtils';

export const LEAD_FILTERS = {
  all: {
    title: 'Total Leads',
    desc: 'Active assigned leads (excludes repeated, converted & lost)',
    icon: 'Users',
  },
  duplicates: {
    title: 'Repeated Leads',
    desc: 'Leads marked repeated — shown only in this list',
    icon: 'Copy',
  },
  returned: {
    title: 'Unassigned Leads',
    desc: 'Leads waiting to be reassigned',
    icon: 'Undo2',
  },
  new: { title: 'Fresh / Today Leads', desc: 'Leads created or assigned to you today', icon: 'Sparkles' },
  contacted: { title: 'Connected Leads', desc: 'Leads where the call was picked / connected', icon: 'Phone' },
  'working-progress': { title: 'Work in Progress', desc: 'Leads being worked — requirements not yet confirmed', icon: 'Loader' },
  'follow-up': { title: 'Follow-up Leads', desc: 'Active pipeline requiring nurturing', icon: 'CalendarClock' },
  hot: { title: 'Hot Leads', desc: 'High budget, urgent travel, or repeat customers', icon: 'Flame' },
  converted: { title: 'Converted Leads', desc: 'Successfully closed bookings', icon: 'Trophy' },
  lost: { title: 'Lost Leads', desc: 'Closed-lost opportunities', icon: 'XCircle' },
  reactivated: {
    title: 'Reactivated Leads',
    desc: 'Leads recovered by your manager — add follow-up to mark Active',
    icon: 'RefreshCw',
  },
};

export const EXEC_FILTER_THEMES = {
  all: {
    gradient: 'from-brand-500/25 via-sky-500/15 to-cyan-500/20',
    border: 'border-sky-500/30',
    icon: 'text-sky-600',
  },
  duplicates: {
    gradient: 'from-amber-500/25 via-orange-500/15 to-rose-500/15',
    border: 'border-amber-500/30',
    icon: 'text-amber-600',
  },
  returned: {
    gradient: 'from-amber-500/25 via-orange-500/15 to-rose-500/15',
    border: 'border-amber-500/30',
    icon: 'text-amber-600',
  },
  new: {
    gradient: 'from-sky-500/25 via-cyan-500/15 to-blue-500/20',
    border: 'border-sky-500/30',
    icon: 'text-sky-600',
  },
  contacted: {
    gradient: 'from-violet-500/20 via-purple-500/15 to-indigo-500/15',
    border: 'border-violet-500/25',
    icon: 'text-violet-600',
  },
  'working-progress': {
    gradient: 'from-orange-500/25 via-amber-500/15 to-yellow-500/20',
    border: 'border-orange-500/30',
    icon: 'text-orange-600',
  },
  'follow-up': {
    gradient: 'from-amber-500/25 via-orange-500/15 to-yellow-500/20',
    border: 'border-amber-500/30',
    icon: 'text-amber-600',
  },
  hot: {
    gradient: 'from-rose-500/25 via-orange-500/20 to-amber-500/15',
    border: 'border-rose-500/30',
    icon: 'text-rose-600',
  },
  converted: {
    gradient: 'from-emerald-500/20 via-teal-500/15 to-green-500/15',
    border: 'border-emerald-500/25',
    icon: 'text-emerald-600',
  },
  lost: {
    gradient: 'from-slate-500/15 via-zinc-500/10 to-neutral-500/10',
    border: 'border-slate-500/25',
    icon: 'text-slate-500',
  },
  reactivated: {
    gradient: 'from-teal-500/25 via-cyan-500/15 to-emerald-500/15',
    border: 'border-teal-500/30',
    icon: 'text-teal-600',
  },
};

export const QUOTE_STATUS_STYLES = {
  draft: 'bg-slate-500/15 text-slate-600 ring-slate-400/30',
  pending_approval: 'bg-amber-500/15 text-amber-800 ring-amber-400/30',
  sent: 'bg-sky-500/15 text-sky-700 ring-sky-400/30',
  viewed: 'bg-violet-500/15 text-violet-700 ring-violet-400/30',
  negotiation: 'bg-amber-500/15 text-amber-700 ring-amber-400/30',
  approved: 'bg-emerald-500/15 text-emerald-700 ring-emerald-400/30',
  rejected: 'bg-rose-500/15 text-rose-700 ring-rose-400/30',
};

export function formatTravelDate(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatFollowUpDate(date) {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
