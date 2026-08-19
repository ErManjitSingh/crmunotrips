import { cn } from '../../lib/utils';
import {
  getExecutiveSetStatusDisplay,
  getLeadListStatusDisplay,
  listStatusTextClass,
} from '../../lib/executiveStatusDisplay';

const config = {
  new: {
    class: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 ring-slate-500/25',
    dot: 'bg-slate-500',
  },
  contacted: {
    class: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 ring-indigo-500/25',
    dot: 'bg-indigo-500',
  },
  working_progress: {
    class: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 ring-orange-500/25',
    dot: 'bg-orange-500',
  },
  qualified: {
    class: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-emerald-500/25',
    dot: 'bg-emerald-500',
  },
  quotation_sent: {
    class: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 ring-blue-500/25',
    dot: 'bg-blue-500',
  },
  follow_up: {
    class: 'bg-violet-500/10 text-violet-700 dark:text-violet-300 ring-violet-500/25',
    dot: 'bg-violet-500',
  },
  negotiation: {
    class: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-amber-500/25',
    dot: 'bg-amber-500',
  },
  reactivated: {
    class: 'bg-teal-500/10 text-teal-700 dark:text-teal-300 ring-teal-500/25',
    dot: 'bg-teal-500',
  },
  converted: {
    class: 'bg-emerald-600/10 text-emerald-800 dark:text-emerald-300 ring-emerald-600/25',
    dot: 'bg-emerald-600',
  },
  lost: {
    class: 'bg-red-500/10 text-red-700 dark:text-red-300 ring-red-500/25',
    dot: 'bg-red-500',
  },
  booked_from_another_company: {
    class: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 ring-rose-500/25',
    dot: 'bg-rose-500',
  },
  proposal: {
    class: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 ring-blue-500/25',
    dot: 'bg-blue-500',
  },
  won: {
    class: 'bg-emerald-600/10 text-emerald-800 dark:text-emerald-300 ring-emerald-600/25',
    dot: 'bg-emerald-600',
  },
};

export default function LeadStatusBadge({
  status,
  pulse = false,
  size = 'md',
  reason,
  lead,
  listMode = false,
}) {
  const resolved = lead || { status, statusReason: reason };
  const display = listMode
    ? getLeadListStatusDisplay(resolved)
    : getExecutiveSetStatusDisplay(resolved);
  // If executive set an option but pipeline still says new, style as follow-up
  const styleKey = listMode
    ? display.bucket || 'new'
    : status === 'new' && display.label && display.label !== 'New'
      ? 'follow_up'
      : status || 'new';
  const c = listMode
    ? { class: display.className, dot: display.dotClass }
    : config[styleKey] || config.new;
  const showPulse = pulse && (listMode ? display.bucket === 'new' : styleKey === 'new');

  return (
    <div className="flex min-w-0 flex-col items-start gap-0.5">
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full font-medium ring-1 ring-inset whitespace-nowrap max-w-[180px] truncate',
          size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
          c.class,
          showPulse && 'animate-pulse-soft'
        )}
        title={display.title}
      >
        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', c.dot, showPulse && 'animate-pulse')} />
        <span className={listMode ? listStatusTextClass(display) : undefined}>{display.label}</span>
      </span>
      {display.detail ? (
        <span
          className="max-w-[160px] truncate text-[10px] font-medium leading-tight text-slate-500"
          title={display.detail}
        >
          {display.detail}
        </span>
      ) : null}
    </div>
  );
}
