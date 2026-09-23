import AnalyticsCard, { BarSkeleton, SectionEmpty } from './AnalyticsCard';
import { CATEGORY_LABELS, formatNumber, formatPercent } from '../../lib/coldCallingAnalytics';
import { STATUS_THEME } from '../executive-lead-status/statusTheme';
import { cn } from '../../lib/utils';

/** Where the assigned leads are RIGHT NOW (current status). Counts and percentages are the server's. */
export default function StatusDistributionCard({ distribution = [], assigned = 0, loading = false }) {
  return (
    <AnalyticsCard title="Current lead status" subtitle="Where the assigned leads are now">
      {loading ? (
        <BarSkeleton rows={5} />
      ) : !assigned ? (
        <SectionEmpty>No leads were assigned to Cold Calling for these filters.</SectionEmpty>
      ) : (
        <>
          <ul className="space-y-2.5">
            {distribution
              .filter((item) => item.key !== 'unclassified' || item.count > 0)
              .map((item) => {
                const theme = STATUS_THEME[item.key] || STATUS_THEME.unclassified;
                return (
                  <li key={item.key} data-status={item.key}>
                    <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                      <span className="flex items-center gap-2 font-semibold text-slate-700">
                        <span className={cn('h-2 w-2 rounded-full', theme.dot)} aria-hidden="true" />
                        {CATEGORY_LABELS[item.key] || item.key}
                      </span>
                      <span className="metric-tabular text-slate-900">
                        <span className="font-bold">{formatNumber(item.count)}</span>
                        <span className="ml-1.5 text-xs text-slate-500">{formatPercent(item.percentOfAssigned)}</span>
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${item.count} of ${assigned} assigned leads`}>
                      <div className={cn('h-full rounded-full', theme.bar)} style={{ width: `${item.percentOfAssigned || 0}%` }} />
                    </div>
                  </li>
                );
              })}
          </ul>
          <p className="mt-3 text-[11px] text-slate-500">Percentages are of the {formatNumber(assigned)} assigned leads.</p>
        </>
      )}
    </AnalyticsCard>
  );
}
