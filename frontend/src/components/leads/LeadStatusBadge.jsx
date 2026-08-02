import { cn } from '../../lib/utils';

const config = {
  new: { label: 'New Lead', class: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 ring-blue-500/25', dot: 'bg-blue-500' },
  contacted: { label: 'Connected', class: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 ring-indigo-500/25', dot: 'bg-indigo-500' },
  working_progress: { label: 'Working Progress', class: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 ring-cyan-500/25', dot: 'bg-cyan-500' },
  follow_up: { label: 'Follow Up', class: 'bg-violet-500/10 text-violet-700 dark:text-violet-300 ring-violet-500/25', dot: 'bg-violet-500' },
  quotation_sent: { label: 'Quotation Sent', class: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-amber-500/25', dot: 'bg-amber-500' },
  negotiation: { label: 'Negotiation', class: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 ring-orange-500/25', dot: 'bg-orange-500' },
  reactivated: { label: 'Reactivated', class: 'bg-teal-500/10 text-teal-700 dark:text-teal-300 ring-teal-500/25', dot: 'bg-teal-500' },
  converted: { label: 'Converted', class: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-emerald-500/25', dot: 'bg-emerald-500' },
  lost: { label: 'Lost', class: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 ring-slate-500/25', dot: 'bg-slate-400' },
  booked_from_another_company: {
    label: 'Booked From Another Company',
    class: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 ring-rose-500/25',
    dot: 'bg-rose-500',
  },
  // legacy aliases
  qualified: { label: 'Follow Up', class: 'bg-violet-500/10 text-violet-700 dark:text-violet-300 ring-violet-500/25', dot: 'bg-violet-500' },
  proposal: { label: 'Quotation Sent', class: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-amber-500/25', dot: 'bg-amber-500' },
  won: { label: 'Converted', class: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-emerald-500/25', dot: 'bg-emerald-500' },
};

export default function LeadStatusBadge({ status, pulse = false, size = 'md' }) {
  const c = config[status] || config.new;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium ring-1 ring-inset whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
        c.class,
        pulse && 'animate-pulse-soft'
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', c.dot, pulse && 'animate-pulse')} />
      {c.label}
    </span>
  );
}
