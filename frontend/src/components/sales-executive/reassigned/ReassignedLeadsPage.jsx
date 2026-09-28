import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { AlertTriangle, ArrowRightLeft, Eye } from 'lucide-react';
import PageHeader from '../../ui/PageHeader';
import TablePagination from '../../ui/TablePagination';
import ReassignedLeadDetailModal from './ReassignedLeadDetailModal';
import { ReassignedBanner, BucketBadge } from './ReassignedParts';
import { fetchMyReassignedLeads } from '../../../services/leadEnterpriseApi';
import { formatCallDateTime } from '../../../lib/coldCallingCalls';
import { formatLeadId } from '../../leads/constants';
import { DestinationChip, TravelDateCell } from '../../sales-manager/LeadListBadges';

const PAGE_SIZE = 25;

/**
 * /sales-executive/leads/reassigned — leads that were MINE and were handed to another executive through
 * Cold Calling. Read-only by design: the server no longer treats me as the owner, so the only action here
 * is View (summary, calls, timeline, ownership chain). Rows are dimmed and struck through so they can't be
 * mistaken for active leads, but they are not hidden — the history stays visible.
 */
export default function ReassignedLeadsPage() {
  const [pageIndex, setPageIndex] = useState(0);
  const [viewLeadId, setViewLeadId] = useState(null);
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['sales-executive', 'reassigned-leads', pageIndex],
    queryFn: () => fetchMyReassignedLeads({ page: pageIndex + 1, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
  const rows = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reassigned Leads"
        description="Leads that were yours and have been reassigned to another executive. You can still view their history; they are no longer part of your active leads."
        breadcrumbs={['Sales Executive', 'My Leads', 'Reassigned']}
      />

      {isError ? (
        <div role="alert" className="flex flex-col items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-10 text-center">
          <AlertTriangle className="h-7 w-7 text-rose-500" aria-hidden="true" />
          <p className="text-sm font-semibold text-rose-800">{error?.response?.data?.message || 'Couldn’t load reassigned leads'}</p>
          <button type="button" onClick={() => refetch()} className="text-xs font-semibold text-rose-700 underline">Try again</button>
        </div>
      ) : isPending ? (
        <ul className="space-y-2" aria-busy="true">{[...Array(4)].map((_, i) => <li key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />)}</ul>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-subtle bg-white px-4 py-14 text-center">
          <ArrowRightLeft className="h-7 w-7 text-content-muted" aria-hidden="true" />
          <p className="text-sm font-semibold text-content-primary">No reassigned leads</p>
          <p className="max-w-sm text-xs text-content-muted">When one of your leads is reassigned to another executive, it will be listed here for reference.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row._id} data-reassigned="true" className="rounded-2xl border border-amber-200/80 bg-white/70 p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 opacity-70">
                  <p className="text-xs font-semibold text-slate-500">{formatLeadId(row._id)}{row.leadId ? ` · ${row.leadId}` : ''}</p>
                  <p className="mt-0.5 truncate text-base font-bold text-slate-700 line-through decoration-slate-400">{row.name}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <BucketBadge bucket={row.bucket} />
                    <DestinationChip name={row.destination} />
                    <TravelDateCell date={row.travelDate} />
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-800 ring-1 ring-inset ring-amber-200">Reassigned</span>
                  <button
                    type="button"
                    onClick={() => setViewLeadId(row._id)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-subtle bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/70"
                  >
                    <Eye className="h-4 w-4" aria-hidden="true" /> View history
                  </button>
                </div>
              </div>
              <ReassignedBanner message={row.message} className="mt-3" />
              <p className="mt-2 text-xs text-slate-500">
                Original owner <span className="font-semibold text-slate-700">{row.originalOwner?.name || '—'}</span>
                {' · '}Current owner <span className="font-semibold text-slate-700">{row.currentOwner?.name || '—'}</span>
                {row.reassignedAt && <>{' · '}Reassigned {formatCallDateTime(row.reassignedAt)}{row.reassignedBy ? ` by ${row.reassignedBy} (Cold Calling)` : ''}</>}
              </p>
            </li>
          ))}
        </ul>
      )}

      {!isPending && !isError && total > PAGE_SIZE && (
        <TablePagination
          pageIndex={pageIndex}
          pageSize={PAGE_SIZE}
          pageCount={data?.pagination?.totalPages || 1}
          total={total}
          onPageChange={setPageIndex}
          totalLabel="leads"
        />
      )}

      <ReassignedLeadDetailModal open={Boolean(viewLeadId)} leadId={viewLeadId} onClose={() => setViewLeadId(null)} />
    </div>
  );
}
