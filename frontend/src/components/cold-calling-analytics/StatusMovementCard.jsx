import AnalyticsCard, { BarSkeleton, SectionEmpty } from './AnalyticsCard';
import { MOVEMENT_HINTS, MOVEMENT_LABELS, MOVEMENT_THEME, formatNumber, formatPercent } from '../../lib/coldCallingAnalytics';
import { STATUS_THEME } from '../executive-lead-status/statusTheme';
import { cn } from '../../lib/utils';

/** How the Cold leads that were sent to Cold Calling progressed. Every count is the server's. */
export default function StatusMovementCard({ movements = [], assigned = 0, loading = false }) {
  return (
    <AnalyticsCard title="Cold lead progression" subtitle={`Of ${formatNumber(assigned)} assigned leads`}>
      {loading ? (
        <BarSkeleton rows={4} />
      ) : !assigned ? (
        <SectionEmpty>No movement to show: nothing was assigned for these filters.</SectionEmpty>
      ) : (
        <>
          <ul className="space-y-3">
            {movements.map((movement) => {
              const theme = STATUS_THEME[MOVEMENT_THEME[movement.key]] || STATUS_THEME.unclassified;
              return (
                <li key={movement.key} data-movement={movement.key} title={MOVEMENT_HINTS[movement.key]}>
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-semibold text-slate-700">{MOVEMENT_LABELS[movement.key]}</span>
                    <span className="metric-tabular text-slate-900">
                      <span className="font-bold">{formatNumber(movement.leads)}</span>
                      <span className="ml-1.5 text-xs text-slate-500">{formatPercent(movement.percentOfAssigned)}</span>
                    </span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-md bg-slate-100" role="img" aria-label={`${MOVEMENT_LABELS[movement.key]}: ${movement.leads} of ${assigned}`}>
                    <div className={cn('h-full rounded-md', theme.bar)} style={{ width: `${movement.percentOfAssigned || 0}%` }} />
                  </div>
                  {movement.byAgent != null && movement.leads > 0 && (
                    <p className="mt-0.5 text-[11px] text-slate-500">{formatNumber(movement.byAgent)} recorded on the agent&apos;s own calls</p>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
            Warm / Hot: reached at any point after assignment, from status history. Converted: current status.
          </p>
        </>
      )}
    </AnalyticsCard>
  );
}
