import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { AlertTriangle, PhoneCall, X } from 'lucide-react';
import AppModal from '../ui/AppModal';
import { fetchColdCallingCallHistory } from '../../services/leadEnterpriseApi';
import { formatCallDuration } from '../../lib/callSession';
import { formatCallDateTime, outcomeLabel } from '../../lib/coldCallingCalls';
import { shouldRetryExecutiveLeadStatus } from '../../lib/executiveLeadStatusFilters';

const PAGE_SIZE = 10;

/**
 * The signed-in agent's own calls on one lead, newest first. One request when opened (never one per
 * row on My Leads). It shows exactly what the server returns for the agent — their own calls only.
 */
export default function ColdCallHistoryModal({ open, lead, onClose }) {
  const [page, setPage] = useState(1);
  const leadId = lead?._id;
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['cold-calling', 'call-history', leadId, page],
    queryFn: () => fetchColdCallingCallHistory(leadId, { page, limit: PAGE_SIZE }),
    enabled: Boolean(open && leadId),
    placeholderData: keepPreviousData,
    retry: shouldRetryExecutiveLeadStatus,
  });
  const calls = data?.data ?? [];
  const totalPages = data?.pagination?.totalPages || 1;

  return (
    <AppModal open={open} onClose={onClose} size="lg">
      <div className="space-y-4 p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">Call history</p>
            <h3 className="mt-1 truncate text-xl font-bold text-content-primary">{lead?.name}</h3>
            <p className="mt-0.5 text-xs text-content-muted">Your calls on this lead</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-content-muted transition hover:bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70"
          >
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
          <ul className="space-y-2" aria-busy="true">
            {[...Array(3)].map((_, i) => <li key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}
          </ul>
        ) : calls.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-subtle px-4 py-10 text-center">
            <PhoneCall className="h-6 w-6 text-content-muted" aria-hidden="true" />
            <p className="text-sm font-semibold text-content-primary">No calls yet</p>
            <p className="text-xs text-content-muted">Calls you make on this lead will be listed here.</p>
          </div>
        ) : (
          <ol className="divide-y divide-slate-100 rounded-xl border border-subtle">
            {calls.map((call) => (
              <li key={call._id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-content-primary">
                    {call.caller?.name || 'You'} <span className="font-normal text-content-muted">· {formatCallDateTime(call.startedAt)}</span>
                  </p>
                  {call.notes && <p className="mt-0.5 max-w-md truncate text-xs text-content-muted" title={call.notes}>{call.notes}</p>}
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="metric-tabular font-semibold text-slate-700">{formatCallDuration(call.duration)}</span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">{outcomeLabel(call.outcome)}</span>
                </div>
              </li>
            ))}
          </ol>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between text-xs text-content-muted">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg px-2 py-1 font-semibold disabled:opacity-40">Previous</button>
            <span>Page {page} of {totalPages}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg px-2 py-1 font-semibold disabled:opacity-40">Next</button>
          </div>
        )}
      </div>
    </AppModal>
  );
}
