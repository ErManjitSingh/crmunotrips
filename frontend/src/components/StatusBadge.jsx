const statusStyles = {
  new: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 ring-slate-500/20',
  contacted: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 ring-indigo-500/20',
  working_progress: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 ring-orange-500/20',
  qualified: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20',
  quotation_sent: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-blue-500/20',
  follow_up: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 ring-violet-500/20',
  proposal: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-blue-500/20',
  converted: 'bg-emerald-600/10 text-emerald-800 dark:text-emerald-300 ring-emerald-600/20',
  won: 'bg-emerald-600/10 text-emerald-800 dark:text-emerald-300 ring-emerald-600/20',
  lost: 'bg-red-500/10 text-red-600 dark:text-red-400 ring-red-500/20',
  booked_from_another_company: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 ring-rose-500/20',
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/20',
  completed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20',
  cancelled: 'bg-slate-500/10 text-slate-500 ring-slate-500/20',
};

const labels = {
  new: 'New',
  contacted: 'Contacted',
  working_progress: 'Working',
  qualified: 'Qualified',
  quotation_sent: 'Quotation',
  follow_up: 'Follow-up',
  proposal: 'Quotation',
  converted: 'Booking',
  won: 'Booking',
  lost: 'Lost',
  booked_from_another_company: 'Booked Elsewhere',
  pending: 'Pending',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export default function StatusBadge({ status, pulse = false }) {
  const style = statusStyles[status] || statusStyles.new;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ring-inset capitalize ${style} ${
        pulse ? 'animate-pulse-soft' : ''
      }`}
    >
      {(status === 'pending' || status === 'new') && pulse && (
        <span className="w-1.5 h-1.5 rounded-full bg-current" />
      )}
      {labels[status] || status}
    </span>
  );
}
