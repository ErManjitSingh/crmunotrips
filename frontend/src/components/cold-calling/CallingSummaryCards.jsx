import { cn } from '../../lib/utils';
import { formatCount } from '../../lib/executiveLeadStatusFilters';
import { EMPTY_CALLING_SUMMARY } from '../../lib/coldCallingWorkspace';
import { STATUS_THEME } from '../executive-lead-status/statusTheme';

/** Same semantic palette as Executive Lead Status: Assigned violet, Cold blue, Warm amber, Hot rose, neutral slate. */
const CARDS = [
  { key: 'assigned', label: 'Assigned Leads', theme: STATUS_THEME.assigned, className: 'col-span-2 sm:col-span-1' },
  { key: 'calledToday', label: 'Called Today', theme: STATUS_THEME.unclassified },
  { key: 'stillCold', label: 'Still Cold', theme: STATUS_THEME.cold },
  { key: 'movedToWarm', label: 'Moved to Warm', theme: STATUS_THEME.warm },
  { key: 'movedToHot', label: 'Moved to Hot', theme: STATUS_THEME.hot },
];

/** Five compact tiles. Values default to the real empty state (zeros) — see EMPTY_CALLING_SUMMARY. */
export default function CallingSummaryCards({ summary = EMPTY_CALLING_SUMMARY }) {
  return (
    <section aria-label="Calling summary" className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
      {CARDS.map(({ key, label, theme, className }) => (
        <div key={key} className={cn('rounded-xl border px-3.5 py-3 shadow-sm', theme.card, className)}>
          <span className="flex items-center gap-2">
            <span className={cn('h-2 w-2 rounded-full', theme.dot)} aria-hidden="true" />
            <span className={cn('text-[11px] font-bold uppercase tracking-wide', theme.text)}>{label}</span>
          </span>
          <span className={cn('metric-tabular mt-1.5 block text-2xl font-bold leading-none', theme.strong)}>
            {summary[key] == null ? '—' : formatCount(summary[key])}
          </span>
        </div>
      ))}
    </section>
  );
}
