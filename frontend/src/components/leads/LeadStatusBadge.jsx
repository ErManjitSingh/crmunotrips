import { cn } from '../../lib/utils';
import { getLeadStatusLabel } from '../../lib/leadStatusLabel';
import { formatLostReasonDisplay } from '../../constants/salesSop';

const config = {
  new: {
    label: 'New',
    class: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 ring-slate-500/25',
    dot: 'bg-slate-500',
  },
  contacted: {
    label: 'Contacted',
    class: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 ring-indigo-500/25',
    dot: 'bg-indigo-500',
  },
  working_progress: {
    label: 'Working',
    class: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 ring-orange-500/25',
    dot: 'bg-orange-500',
  },
  qualified: {
    label: 'Qualified',
    class: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-emerald-500/25',
    dot: 'bg-emerald-500',
  },
  quotation_sent: {
    label: 'Quotation',
    class: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 ring-blue-500/25',
    dot: 'bg-blue-500',
  },
  follow_up: {
    label: 'Follow-up',
    class: 'bg-violet-500/10 text-violet-700 dark:text-violet-300 ring-violet-500/25',
    dot: 'bg-violet-500',
  },
  negotiation: {
    label: 'Negotiation',
    class: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-amber-500/25',
    dot: 'bg-amber-500',
  },
  reactivated: {
    label: 'Reactivated',
    class: 'bg-teal-500/10 text-teal-700 dark:text-teal-300 ring-teal-500/25',
    dot: 'bg-teal-500',
  },
  converted: {
    label: 'Booking',
    class: 'bg-emerald-600/10 text-emerald-800 dark:text-emerald-300 ring-emerald-600/25',
    dot: 'bg-emerald-600',
  },
  lost: {
    label: 'Lost',
    class: 'bg-red-500/10 text-red-700 dark:text-red-300 ring-red-500/25',
    dot: 'bg-red-500',
  },
  booked_from_another_company: {
    label: 'Booked Elsewhere',
    class: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 ring-rose-500/25',
    dot: 'bg-rose-500',
  },
  // legacy aliases
  proposal: {
    label: 'Quotation',
    class: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 ring-blue-500/25',
    dot: 'bg-blue-500',
  },
  won: {
    label: 'Booking',
    class: 'bg-emerald-600/10 text-emerald-800 dark:text-emerald-300 ring-emerald-600/25',
    dot: 'bg-emerald-600',
  },
};

export default function LeadStatusBadge({ status, pulse = false, size = 'md', reason }) {
  const c = config[status] || config.new;
  const reasonLabel =
    status === 'lost' || status === 'booked_from_another_company'
      ? formatLostReasonDisplay(reason)
      : '';

  return (
    <div className="flex min-w-0 flex-col items-start gap-0.5">
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full font-medium ring-1 ring-inset whitespace-nowrap',
          size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
          c.class,
          pulse && 'animate-pulse-soft'
        )}
        title={reasonLabel ? `${getLeadStatusLabel(status)} — ${reasonLabel}` : getLeadStatusLabel(status)}
      >
        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', c.dot, pulse && 'animate-pulse')} />
        {c.label}
      </span>
      {reasonLabel ? (
        <span
          className="max-w-[160px] truncate text-[10px] font-medium leading-tight text-red-600/90"
          title={reasonLabel}
        >
          {reasonLabel}
        </span>
      ) : null}
    </div>
  );
}
