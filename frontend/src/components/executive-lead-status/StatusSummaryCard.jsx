import { cn } from '../../lib/utils';
import { formatCount } from '../../lib/executiveLeadStatusFilters';
import { STATUS_THEME } from './statusTheme';

/**
 * One status tile. Plain display on the overview; on the executive detail it is a real <button>
 * (`onClick`) that filters the lead list, with aria-pressed reflecting the selection.
 */
export default function StatusSummaryCard({ status, value, loading, onClick, active = false, className }) {
  const theme = STATUS_THEME[status];
  const body = (
    <>
      <span className="flex items-center gap-2">
        <span className={cn('h-2 w-2 rounded-full', theme.dot)} aria-hidden="true" />
        <span className={cn('text-[11px] font-bold uppercase tracking-wide', theme.text)}>{theme.label}</span>
      </span>
      {loading ? (
        <span className="mt-2 block h-7 w-14 animate-pulse rounded bg-white/80" />
      ) : (
        <span className={cn('metric-tabular mt-1.5 block text-2xl font-bold leading-none', theme.strong)}>
          {formatCount(value)}
        </span>
      )}
    </>
  );

  const base = cn(
    'block w-full rounded-xl border px-3.5 py-3 text-left shadow-sm transition-all duration-200',
    theme.card,
    active && theme.cardActive,
    className
  );

  if (!onClick) return <div className={base}>{body}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        base,
        'hover:-translate-y-px hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60'
      )}
    >
      {body}
    </button>
  );
}
