import { cn } from '../lib/utils';
import { getLeadStatusLabel } from '../lib/leadStatusLabel';
import { pipelineStatusToTemperatureLabel } from '../lib/leadTemperatureStatus';

const tempStyles = {
  Warm: 'bg-amber-500/10 text-amber-800 dark:text-amber-300 ring-amber-500/25',
  Hot: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 ring-rose-500/25',
  Cold: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 ring-slate-500/25',
  Booking: 'bg-emerald-600/10 text-emerald-800 dark:text-emerald-300 ring-emerald-600/25',
  'No status': 'bg-sky-500/10 text-sky-700 dark:text-sky-300 ring-sky-500/25',
};

export default function StatusBadge({ status, pulse = false }) {
  const label = getLeadStatusLabel(status) || pipelineStatusToTemperatureLabel(status);
  const style = tempStyles[label] || tempStyles.Cold;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset',
        style,
        pulse && (label === 'No status') && 'animate-pulse'
      )}
    >
      {label}
    </span>
  );
}
