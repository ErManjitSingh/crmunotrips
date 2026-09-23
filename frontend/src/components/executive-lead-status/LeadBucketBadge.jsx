import { Headphones } from 'lucide-react';
import { cn } from '../../lib/utils';
import { coldCallingIndicator } from '../../lib/coldCallingAssignment';
import { describeLeadStatusReason } from '../../lib/executiveLeadStatusReason';
import { STATUS_THEME } from './statusTheme';

/** Cold / Warm / Hot / Unclassified badge — colour + text (never colour alone) for accessibility. */
export default function LeadBucketBadge({ bucket, className }) {
  const theme = STATUS_THEME[bucket] || STATUS_THEME.unclassified;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ring-1 ring-inset',
        theme.badge,
        className
      )}
      aria-label={`Status: ${theme.label}`}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', theme.dot)} aria-hidden="true" />
      {theme.label}
    </span>
  );
}

/**
 * Status badge (dominant) + its reason (secondary, truncated with the full text on hover).
 * `stacked` puts the reason under the badge, right-aligned, for the phone cards.
 */
export function LeadStatusWithReason({ lead, stacked = false }) {
  const reason = describeLeadStatusReason(lead);
  return (
    <span className={cn('flex min-w-0 max-w-full', stacked ? 'flex-col items-end gap-0.5' : 'items-center gap-1.5')}>
      <LeadBucketBadge bucket={lead.bucket} className="shrink-0" />
      <span className="min-w-0 max-w-full truncate text-xs font-medium text-slate-500" title={reason}>
        {!stacked && <span aria-hidden="true">· </span>}
        <span className="sr-only">Reason: </span>
        {reason}
      </span>
    </span>
  );
}

/**
 * Compact Cold Calling indicator under a lead's status: which agent has it, or that a Cold lead is
 * still unassigned. Deliberately neutral / fuchsia — never the Cold blue — so it reads as a
 * secondary fact about the lead, not a status.
 */
export function ColdCallingIndicator({ lead, stacked = false }) {
  const indicator = coldCallingIndicator(lead);
  if (!indicator) return null;
  const assigned = indicator.kind === 'assigned';
  return (
    <span
      className={cn(
        'mt-1 flex min-w-0 max-w-full items-center gap-1 text-[11px] font-semibold',
        stacked && 'justify-end',
        assigned ? 'text-fuchsia-700' : 'text-slate-400'
      )}
      data-cold-calling={indicator.kind}
    >
      <Headphones className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span className="truncate" title={indicator.label}>{indicator.label}</span>
    </span>
  );
}
