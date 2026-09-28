import { AlertTriangle } from 'lucide-react';
import { STATUS_THEME } from '../../executive-lead-status/statusTheme';
import { cn } from '../../../lib/utils';

/**
 * The one message every reassigned-lead surface shows. The text comes from the server
 * ("This lead has been reassigned to Aman and is no longer part of your active leads.").
 */
export function ReassignedBanner({ message, className }) {
  if (!message) return null;
  return (
    <p role="status" className={cn('flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900', className)}>
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
      <span>{message}</span>
    </p>
  );
}

/** Cold / Warm / Hot badge using the same palette as the rest of the CRM. The status itself is unchanged by a reassignment. */
export function BucketBadge({ bucket }) {
  const theme = STATUS_THEME[bucket] || STATUS_THEME.unclassified;
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ring-1 ring-inset', theme.badge)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', theme.dot)} aria-hidden="true" />
      {theme.label}
    </span>
  );
}
