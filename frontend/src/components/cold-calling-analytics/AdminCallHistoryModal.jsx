import { AlertTriangle, PhoneCall, X } from 'lucide-react';
import AppModal from '../ui/AppModal';
import { useLeadCallHistoryQuery } from '../../features/leads/hooks/useColdCallingAnalyticsQuery';
import { formatDateTime, formatDuration, outcomeLabel } from '../../lib/coldCallingAnalytics';
import { cn } from '../../lib/utils';

const ROLE_LABEL = { cold_calling: 'Cold Calling', sales_executive: 'Sales Executive', team_leader: 'Team Leader', admin: 'Admin', sales_manager: 'Sales Manager' };

/**
 * Every call ever made on one lead, individually (the existing Lead call-notes endpoint): who called
 * (with their role, so Cold Calling and Sales calls are never confused), when, for how long, and the outcome.
 * Fetched only while open — never one request per table row.
 */
export default function AdminCallHistoryModal({ open, lead, onClose }) {
  const { data, isPending, isError, refetch } = useLeadCallHistoryQuery(lead?._id, open);
  const calls = data?.data ?? [];

  return (
    <AppModal open={open} onClose={onClose} size="lg">
      <div className="space-y-4 p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">Call history</p>
            <h3 className="mt-1 truncate text-xl font-bold text-content-primary">{lead?.name}</h3>
            {data?.pagination && <p className="mt-0.5 text-xs text-content-muted">{data.pagination.total} call{data.pagination.total === 1 ? '' : 's'} in total</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-content-muted transition hover:bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/70">
            <X className="h-4 w-4" />
          </button>
        </div>

        {isError ? (
          <div role="alert" className="flex flex-col items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-8 text-center">
            <AlertTriangle className="h-6 w-6 text-rose-500" aria-hidden="true" />
            <p className="text-sm font-semibold text-rose-800">Couldn&apos;t load call history</p>
            <button type="button" onClick={() => refetch()} className="text-xs font-semibold text-rose-700 underline">Try again</button>
          </div>
        ) : isPending ? (
          <ul className="space-y-2" aria-busy="true">{[...Array(3)].map((_, i) => <li key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}</ul>
        ) : calls.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-subtle px-4 py-10 text-center">
            <PhoneCall className="h-6 w-6 text-content-muted" aria-hidden="true" />
            <p className="text-sm font-semibold text-content-primary">No calls yet</p>
          </div>
        ) : (
          <ol className="max-h-[55vh] divide-y divide-slate-100 overflow-y-auto rounded-xl border border-subtle">
            {calls.map((call) => (
              <li key={call._id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3" data-call={call._id}>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-content-primary">
                    {call.userId?.name || 'Unknown'}
                    <span
                      className={cn(
                        'ml-2 rounded-full px-2 py-px text-[10px] font-semibold ring-1 ring-inset',
                        call.userId?.role === 'cold_calling' ? 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200' : 'bg-slate-100 text-slate-600 ring-slate-200'
                      )}
                    >
                      {ROLE_LABEL[call.userId?.role] || call.userId?.role || '—'}
                    </span>
                  </p>
                  <p className="text-xs text-content-muted">{formatDateTime(call.startedAt || call.createdAt)}</p>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="metric-tabular font-semibold text-slate-700">{formatDuration(call.duration)}</span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">{outcomeLabel(call.outcome)}</span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </AppModal>
  );
}
