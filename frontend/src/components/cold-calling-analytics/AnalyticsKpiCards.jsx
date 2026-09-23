import { cn } from '../../lib/utils';
import { formatKpi } from '../../lib/coldCallingAnalytics';
import { STATUS_THEME } from '../executive-lead-status/statusTheme';

/**
 * Compact KPI tiles. `cards` = [{ key, label, tone, value, format, hint }] from buildKpiCards; the values are
 * the server's. While loading (or refetching a new filter set) the tiles show a skeleton, never a stale number.
 */
export default function AnalyticsKpiCards({ cards, loading = false, columns = 'lg:grid-cols-4', className }) {
  return (
    <section aria-label="Key figures" className={cn('grid grid-cols-2 gap-2.5 sm:grid-cols-4', columns, className)}>
      {cards.map((card) => {
        const theme = STATUS_THEME[card.tone] || STATUS_THEME.unclassified;
        return (
          <div key={card.key} title={card.hint} className={cn('rounded-xl border px-3.5 py-3 shadow-sm', theme.card)} data-kpi={card.key}>
            <span className="flex items-center gap-2">
              <span className={cn('h-2 w-2 shrink-0 rounded-full', theme.dot)} aria-hidden="true" />
              <span className={cn('truncate text-[11px] font-bold uppercase tracking-wide', theme.text)}>{card.label}</span>
            </span>
            {loading ? (
              <span className="mt-2 block h-7 w-16 animate-pulse rounded bg-white/80" />
            ) : (
              <span className={cn('metric-tabular mt-1.5 block text-2xl font-bold leading-none', theme.strong)}>{formatKpi(card)}</span>
            )}
          </div>
        );
      })}
    </section>
  );
}
