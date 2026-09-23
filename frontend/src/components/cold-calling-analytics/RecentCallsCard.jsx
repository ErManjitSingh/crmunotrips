import AnalyticsCard, { BarSkeleton, SectionEmpty } from './AnalyticsCard';
import { OUTCOME_BUCKET_LABELS, formatDateTime, formatDuration, outcomeLabel } from '../../lib/coldCallingAnalytics';

/** The agent's latest calls as recorded (real CallNotes only — nothing synthesised). */
export default function RecentCallsCard({ calls = [], loading = false, className }) {
  return (
    <AnalyticsCard title="Recent activity" subtitle="Latest calls by this agent" className={className}>
      {loading ? (
        <BarSkeleton rows={4} />
      ) : calls.length === 0 ? (
        <SectionEmpty>This agent has not made any calls yet.</SectionEmpty>
      ) : (
        <ul className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
          {calls.map((call) => (
            <li key={call._id} className="flex items-center justify-between gap-3 border-b border-slate-100 py-2" data-recent-call={call._id}>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-slate-800">{call.lead?.name || 'Lead removed'}</span>
                <span className="block text-xs text-slate-500">{formatDateTime(call.startedAt)}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2 text-xs">
                <span className="metric-tabular font-semibold text-slate-700">{formatDuration(call.duration)}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700" title={OUTCOME_BUCKET_LABELS[call.bucket]}>{outcomeLabel(call.outcome)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </AnalyticsCard>
  );
}
