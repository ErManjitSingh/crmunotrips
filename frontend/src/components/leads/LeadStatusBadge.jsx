import { cn } from '../../lib/utils';
import {
  getLeadListStatusDisplay,
  listStatusTextClass,
} from '../../lib/executiveStatusDisplay';

/**
 * listMode=true (default): Warm / Hot / Cold / Converted / No status only.
 * listMode=false (lead open / modal): exact selected option when available.
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

  const showPulse = pulse && display.bucket === 'new';
  const primaryLabel = listMode
    ? display.mainLabel || 'No status'
    : display.label || 'No status';
  const className = listMode
    ? display.listClassName || display.className
    : display.className;
  const dotClass = listMode
    ? display.listDotClass || display.dotClass
    : display.dotClass;

  const showExactHint =
    !listMode &&
    display.exactLabel &&
    display.categoryLabel &&
    display.exactLabel !== display.categoryLabel &&
    !['No status', 'Converted'].includes(display.categoryLabel) &&
    display.label === display.exactLabel;

  return (
    <div className="flex min-w-0 flex-col items-start gap-0.5">
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full font-medium ring-1 ring-inset whitespace-nowrap max-w-[220px] truncate',
          size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
          className,
          showPulse && 'animate-pulse-soft'
        )}
        title={listMode ? primaryLabel : display.title}
      >
        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotClass, showPulse && 'animate-pulse')} />
        <span className={listStatusTextClass(display)}>{primaryLabel}</span>
      </span>
      {showExactHint ? (
        <span
          className="max-w-[160px] truncate text-[10px] font-medium leading-tight text-slate-500"
          title={display.categoryLabel}
        >
          {display.categoryLabel}
        </span>
      ) : null}
    </div>
  );
}
