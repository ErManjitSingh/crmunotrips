import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowDown, Ban, X } from 'lucide-react';
import AppModal from '../../ui/AppModal';
import { ReassignedBanner, BucketBadge } from './ReassignedParts';
import { fetchMyReassignedLead } from '../../../services/leadEnterpriseApi';
import { formatCallDateTime, outcomeLabel } from '../../../lib/coldCallingCalls';
import { formatCallDuration } from '../../../lib/callSession';
import { getStatusReasonLabel } from '../../../lib/executiveStatusDisplay';
import { cn } from '../../../lib/utils';

const TABS = [
  ['history', 'Ownership'],
  ['calls', 'Calls'],
  ['timeline', 'Timeline'],
];
const BUCKET_PILL = {
  connected: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  no_answer: 'bg-amber-50 text-amber-700 ring-amber-200',
  failed: 'bg-rose-50 text-rose-700 ring-rose-200',
};
const UNAVAILABLE = ['Call', 'Follow-up', 'Edit', 'Change status', 'Reassign'];

/**
 * Read-only view of a lead that was reassigned away from me: summary (no phone / email), the ownership chain,
 * every call and the timeline. There are deliberately NO action buttons — the server rejects them for a
 * previous owner — and the unavailable actions are listed with the reason instead of being silently hidden.
 */
export default function ReassignedLeadDetailModal({ open, leadId, onClose }) {
  const [tab, setTab] = useState('history');
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['sales-executive', 'reassigned-lead', leadId],
    queryFn: () => fetchMyReassignedLead(leadId),
    enabled: Boolean(open && leadId),
    staleTime: 0,
  });
  const lead = data?.lead;

  return (
    <AppModal open={open} onClose={onClose} size="2xl">
      <div className="space-y-4 p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Reassigned lead · read only</p>
            <h3 className="mt-1 truncate text-xl font-bold text-slate-600 line-through decoration-slate-400">{lead?.name || '…'}</h3>
            {lead && (
              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-content-muted">
                <BucketBadge bucket={lead.bucket} />
                {getStatusReasonLabel(lead.statusReason) && <span>{getStatusReasonLabel(lead.statusReason)}</span>}
                {lead.destination && <span>· {lead.destination}</span>}
                {lead.travelDate && <span>· Travel {formatCallDateTime(lead.travelDate).split(',')[0]}</span>}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-content-muted transition hover:bg-black/5">
            <X className="h-4 w-4" />
          </button>
        </div>

        {isError ? (
          <div role="alert" className="flex flex-col items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-8 text-center">
            <AlertTriangle className="h-6 w-6 text-rose-500" aria-hidden="true" />
            <p className="text-sm font-semibold text-rose-800">{error?.response?.data?.message || 'Couldn’t load this lead'}</p>
            <button type="button" onClick={() => refetch()} className="text-xs font-semibold text-rose-700 underline">Try again</button>
          </div>
        ) : isPending ? (
          <ul className="space-y-2" aria-busy="true">{[...Array(4)].map((_, i) => <li key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />)}</ul>
        ) : (
          <>
            <ReassignedBanner message={data.message} />
            <p className="flex flex-wrap items-center gap-1.5 text-xs text-content-muted">
              <Ban className="h-3.5 w-3.5" aria-hidden="true" /> Not available to you:
              {UNAVAILABLE.map((label) => (
                <span key={label} className="rounded-md bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-500 line-through">{label}</span>
              ))}
            </p>

            <div className="flex w-fit items-center gap-1 rounded-xl border border-subtle bg-white p-1">
              {TABS.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={tab === key}
                  onClick={() => setTab(key)}
                  className={cn('rounded-lg px-3 py-1.5 text-xs font-semibold transition', tab === key ? 'bg-violet-600 text-white shadow-sm' : 'text-content-muted hover:text-content-primary')}
                >
                  {label}{key === 'calls' ? ` (${data.calls.length})` : ''}
                </button>
              ))}
            </div>

            <div className="max-h-[45vh] overflow-y-auto">
              {tab === 'history' && (
                <ol className="space-y-1 rounded-xl border border-subtle p-4 text-sm">
                  <li>
                    <span className="text-xs text-content-muted">Original owner</span>
                    <p className="font-semibold text-content-primary">{data.originalOwner?.name || data.reassignments[0]?.from || '—'}</p>
                  </li>
                  {data.reassignments.map((r, i) => (
                    <li key={`${r.at}-${i}`} className="pl-2">
                      <p className="flex items-center gap-1.5 py-1 text-xs text-content-muted">
                        <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                        Reassigned via Cold Calling{r.by ? ` by ${r.by}` : ''} · {formatCallDateTime(r.at)}
                      </p>
                      <p className="font-semibold text-content-primary">{r.to || '—'}</p>
                    </li>
                  ))}
                  <li className="pt-2 text-xs text-content-muted">
                    Current owner: <span className="font-semibold text-content-primary">{data.currentOwner?.name || '—'}</span>
                  </li>
                </ol>
              )}

              {tab === 'calls' && (
                data.calls.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-subtle px-4 py-8 text-center text-sm text-content-muted">No calls on this lead.</p>
                ) : (
                  <ol className="divide-y divide-slate-100 rounded-xl border border-subtle">
                    {data.calls.map((c) => (
                      <li key={c._id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2.5">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-content-primary">
                            {c.caller?.name || 'Unknown'} <span className="font-normal text-content-muted">· {formatCallDateTime(c.startedAt)}</span>
                          </p>
                          {c.notes && <p className="mt-0.5 max-w-md truncate text-xs text-content-muted" title={c.notes}>{c.notes}</p>}
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="metric-tabular font-semibold text-slate-700">{formatCallDuration(c.duration)}</span>
                          <span className={cn('rounded-full px-2 py-px text-[11px] font-semibold ring-1 ring-inset', BUCKET_PILL[c.bucket] || BUCKET_PILL.failed)}>{outcomeLabel(c.outcome)}</span>
                        </div>
                      </li>
                    ))}
                  </ol>
                )
              )}

              {tab === 'timeline' && (
                <ol className="divide-y divide-slate-100 rounded-xl border border-subtle">
                  {data.timeline.map((t) => (
                    <li key={t._id} className="px-4 py-2.5">
                      <p className="text-sm font-semibold text-content-primary">{t.title}</p>
                      {t.description && <p className="text-xs text-slate-600">{t.description}</p>}
                      <p className="mt-0.5 text-[11px] text-content-muted">{t.actorName} · {formatCallDateTime(t.at)}</p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </>
        )}
      </div>
    </AppModal>
  );
}
