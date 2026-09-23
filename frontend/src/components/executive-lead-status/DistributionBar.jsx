import { cn } from '../../lib/utils';
import { LEAD_BUCKETS } from '../../lib/executiveLeadStatusFilters';
import { STATUS_THEME } from './statusTheme';

/** Cold / Warm / Hot / Unclassified share of an executive's assigned leads, at a glance. */
export default function DistributionBar({ row, className }) {
  const total = row.assigned || 0;
  const label = LEAD_BUCKETS.map((key) => `${row[key] || 0} ${STATUS_THEME[key].label.toLowerCase()}`).join(', ');
  return (
    <span
      role="img"
      aria-label={total ? label : 'No assigned leads'}
      className={cn('flex h-2 w-full min-w-[96px] overflow-hidden rounded-full bg-slate-100', className)}
    >
      {total > 0 &&
        LEAD_BUCKETS.map((key) =>
          row[key] ? (
            <span
              key={key}
              className={cn('h-full', STATUS_THEME[key].bar)}
              style={{ width: `${(row[key] / total) * 100}%` }}
            />
          ) : null
        )}
    </span>
  );
}
