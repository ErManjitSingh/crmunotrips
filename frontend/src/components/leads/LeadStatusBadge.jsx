import { cn } from '../../lib/utils';
import {
  getLeadListStatusDisplay,
  listStatusTextClass,
} from '../../lib/executiveStatusDisplay';

/**
 * Shows Warm / Hot / Cold, Working Progress (Cold→Warm), Booking, or No status.
 */
export default function LeadStatusBadge({
  status,
  pulse = false,
  size = 'md',
  reason,
  lead,
  listMode = true,
}) {
  const resolved = lead || { status, statusReason: reason };
  const display = getLeadListStatusDisplay(resolved);
  const showExact =
    listMode !== false &&
    display.exactLabel &&
    display.exactLabel !== display.label &&
    !['No status', 'Booking', 'Working Progress'].includes(display.label);

  const showPulse = pulse && display.bucket === 'new';

  return (
    <div className="flex min-w-0 flex-col items-start gap-0.5">
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full font-medium ring-1 ring-inset whitespace-nowrap max-w-[180px] truncate',
          size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
          display.className,
          showPulse && 'animate-pulse-soft'
        )}
        title={display.title}
      >
        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', display.dotClass, showPulse && 'animate-pulse')} />
        <span className={listStatusTextClass(display)}>{display.label}</span>
      </span>
      {showExact ? (
        <span
          className="max-w-[160px] truncate text-[10px] font-medium leading-tight text-slate-500"
          title={display.exactLabel}
        >
          {display.exactLabel}
        </span>
      ) : null}
    </div>
  );
}
