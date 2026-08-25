import { cn } from '../../lib/utils';
import {
  getLeadListStatusDisplay,
  listStatusTextClass,
} from '../../lib/executiveStatusDisplay';

/**
 * Shows the option the user selected (e.g. Ready to Book, Package discussed),
 * or Working Progress / Converted / No status. Color comes from Warm/Hot/Cold bucket.
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
  void listMode;

  const showPulse = pulse && display.bucket === 'new';
  const showCategory =
    display.categoryLabel &&
    display.categoryLabel !== display.label &&
    !['No status', 'Converted', 'Working Progress'].includes(display.categoryLabel);

  return (
    <div className="flex min-w-0 flex-col items-start gap-0.5">
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full font-medium ring-1 ring-inset whitespace-nowrap max-w-[200px] truncate',
          size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs',
          display.className,
          showPulse && 'animate-pulse-soft'
        )}
        title={display.title}
      >
        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', display.dotClass, showPulse && 'animate-pulse')} />
        <span className={listStatusTextClass(display)}>{display.label}</span>
      </span>
      {showCategory ? (
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
