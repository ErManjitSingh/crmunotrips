import AnalyticsCard, { BarSkeleton, SectionEmpty } from './AnalyticsCard';
import { OUTCOME_BUCKET_LABELS, formatNumber, outcomeLabel } from '../../lib/coldCallingAnalytics';
import { cn } from '../../lib/utils';

const BUCKET_STYLE = {
  connected: { bar: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  no_answer: { bar: 'bg-amber-400', chip: 'bg-amber-50 text-amber-800 ring-amber-200' },
  failed: { bar: 'bg-slate-400', chip: 'bg-slate-100 text-slate-600 ring-slate-300' },
};

/** Call outcomes exactly as recorded (CallNote.outcome), largest first, tagged with the Call Report bucket. */
export default function CallOutcomesCard({ outcomes = [], totalCalls = 0, loading = false }) {
  const max = outcomes.reduce((m, o) => Math.max(m, o.calls), 0);
  return (
    <AnalyticsCard title="Call outcomes" subtitle={`${formatNumber(totalCalls)} calls`}>
      {loading ? (
        <BarSkeleton rows={5} />
      ) : outcomes.length === 0 ? (
        <SectionEmpty>No calls were made on these leads yet.</SectionEmpty>
      ) : (
        <ul className="space-y-2">
          {outcomes.map((row) => {
            const style = BUCKET_STYLE[row.bucket] || BUCKET_STYLE.failed;
            return (
              <li key={row.outcome} data-outcome={row.outcome}>
                <div className="mb-0.5 flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-semibold text-slate-700">{outcomeLabel(row.outcome)}</span>
                    <span className={cn('shrink-0 rounded-full px-1.5 py-px text-[10px] font-semibold ring-1 ring-inset', style.chip)}>
                      {OUTCOME_BUCKET_LABELS[row.bucket] || row.bucket}
                    </span>
                  </span>
                  <span className="metric-tabular font-bold text-slate-900">{formatNumber(row.calls)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className={cn('h-full rounded-full', style.bar)} style={{ width: `${max ? (row.calls / max) * 100 : 0}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </AnalyticsCard>
  );
}
