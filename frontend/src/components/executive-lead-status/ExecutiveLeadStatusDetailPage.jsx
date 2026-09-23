import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { AlertTriangle, ArrowLeft, CalendarRange, GitBranch, Headphones, Megaphone } from 'lucide-react';
import AssignColdCallingModal from './AssignColdCallingModal';
import ExecutiveAvatar from './ExecutiveAvatar';
import ExecutiveLeadsList from './ExecutiveLeadsList';
import StatusSummaryCard from './StatusSummaryCard';
import { STATUS_ORDER, STATUS_THEME } from './statusTheme';
import TablePagination from '../ui/TablePagination';
import { useExecutiveLeadStatusLeadsQuery } from '../../features/leads/hooks/useExecutiveLeadStatusQuery';
import {
  LEAD_BUCKETS,
  buildOverviewPath,
  describeAssignmentPeriod,
  filtersFromSearchParams,
  formatCount,
  isSummaryConsistent,
} from '../../lib/executiveLeadStatusFilters';
import { getLeadSourceShortLabel } from '../../lib/leadSourceLabels';
import { pruneSelection, toggleAll, toggleId } from '../../lib/coldCallingAssignment';

const PAGE_SIZE = 25;

function ContextChip({ icon: Icon, children }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600">
      <Icon className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
      {children}
    </span>
  );
}

/**
 * /leads/executive-lead-status/:executiveId — every lead in one executive's overview row, for the
 * same period / source / branch the overview was showing (carried in the URL). The five summary
 * tiles double as filters (All / Cold / Warm / Hot / Unclassified) and always show the executive's
 * full row, so Assigned = Cold + Warm + Hot + Unclassified stays visible whatever is selected.
 */
export default function ExecutiveLeadStatusDetailPage() {
  const { executiveId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => filtersFromSearchParams(searchParams), [searchParams]);
  const bucketParam = searchParams.get('bucket');
  const bucket = LEAD_BUCKETS.includes(bucketParam) ? bucketParam : '';
  const { availableBranches } = useSelector((state) => state.branch);

  // The page belongs to one executive + filter context; a different context is page 1 immediately
  // (derived rather than reset in an effect, so no request is ever made for a stale page number).
  const contextKey = `${executiveId}|${searchParams}`;
  const [pageState, setPageState] = useState({ contextKey, index: 0 });
  const pageIndex = pageState.contextKey === contextKey ? pageState.index : 0;
  const setPageIndex = (index) => setPageState({ contextKey, index });

  // Selection belongs to what is on screen (executive + filters + bucket + page): changing any of
  // them starts empty, so a hidden lead can never be assigned by accident.
  const selectionKey = `${contextKey}|${bucket}|${pageIndex}`;
  const [selectionState, setSelectionState] = useState({ key: selectionKey, ids: [] });
  // The modal works on the leads as they were when it opened, so it stays stable while it animates closed.
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignLeads, setAssignLeads] = useState([]);

  const { data, isPending, isError, error, refetch } = useExecutiveLeadStatusLeadsQuery({
    executiveId,
    filters,
    bucket,
    page: pageIndex + 1,
    limit: PAGE_SIZE,
  });

  const selectedIds = selectionState.key === selectionKey ? selectionState.ids : [];
  const setSelectedIds = (ids) => setSelectionState({ key: selectionKey, ids });

  const selectBucket = (next) => {
    const params = new URLSearchParams(searchParams);
    if (next && next !== 'assigned') params.set('bucket', next);
    else params.delete('bucket');
    setSearchParams(params, { replace: true });
  };

  const summary = data?.summary;
  const executive = data?.executive;
  const branchName = availableBranches.find((branch) => branch._id === filters.branchId)?.name;
  const errorMessage = error?.response?.data?.message || error?.message || 'Something went wrong.';
  const selected = bucket || 'assigned';
  const pageLeads = data?.data ?? [];
  // Only the Cold tab offers selection; ids are pruned to rows that are still visible and assignable.
  const validSelectedIds = bucket === 'cold' ? pruneSelection(selectedIds, pageLeads) : [];
  const selectedLeads = pageLeads.filter((lead) => validSelectedIds.includes(lead._id));
  const selection =
    bucket === 'cold'
      ? {
          selectedIds: validSelectedIds,
          onToggle: (id) => setSelectedIds(toggleId(validSelectedIds, id)),
          onToggleAll: () => setSelectedIds(toggleAll(validSelectedIds, pageLeads)),
        }
      : undefined;
  const inconsistent =
    summary && (!isSummaryConsistent(summary) || (!bucket && data.pagination?.total !== summary.assigned));

  return (
    <div className="animate-fade-up px-4 pt-4 lg:px-0 lg:pt-0">
      <Link
        to={buildOverviewPath(filters)}
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg text-sm font-semibold text-violet-700 transition hover:text-violet-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/70"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to Executive Overview
      </Link>

      {isError ? (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50/60 px-4 py-12 text-center">
          <AlertTriangle className="h-8 w-8 text-rose-500" />
          <p className="text-sm font-semibold text-rose-800">Couldn&apos;t load this executive&apos;s leads</p>
          <p className="max-w-md text-xs text-rose-700">{errorMessage}</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="h-9 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-700"
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          <header className="mb-5 flex flex-wrap items-center gap-4">
            <ExecutiveAvatar name={executive?.name} size="lg" />
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wide text-violet-600">Executive Lead Status</p>
              {executive ? (
                <h1 className="truncate text-2xl font-bold tracking-tight text-slate-900">{executive.name}</h1>
              ) : (
                <div className="mt-1 h-7 w-48 animate-pulse rounded bg-slate-100" />
              )}
              <p className="mt-0.5 text-sm text-slate-500">
                {summary ? (
                  <>
                    <span className="font-semibold text-slate-800">{formatCount(summary.assigned)}</span>{' '}
                    Assigned Lead{summary.assigned === 1 ? '' : 's'}
                  </>
                ) : (
                  'Loading…'
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
              <ContextChip icon={CalendarRange}>{describeAssignmentPeriod(filters)} (IST)</ContextChip>
              {filters.source && <ContextChip icon={Megaphone}>{getLeadSourceShortLabel(filters.source)}</ContextChip>}
              {branchName && <ContextChip icon={GitBranch}>{branchName}</ContextChip>}
            </div>
          </header>

          <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5" role="group" aria-label="Filter leads by status">
            {STATUS_ORDER.map((status) => (
              <StatusSummaryCard
                key={status}
                status={status}
                value={summary?.[status]}
                loading={isPending}
                className={status === 'assigned' ? 'col-span-2 sm:col-span-1' : undefined}
                active={selected === status}
                onClick={() => selectBucket(status)}
              />
            ))}
          </div>

          {inconsistent && (
            <p role="alert" className="mb-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
              These counts don&apos;t add up. Refresh the page; if it persists, report it.
            </p>
          )}

          {/* One fixed-height row: the heading, or (while leads are selected) the assignment bar in its place, so rows never shift under the cursor. */}
          {selectedLeads.length > 0 ? (
            <div
              role="region"
              aria-label="Cold Calling assignment"
              className="mb-2 flex min-h-[44px] flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-violet-200 bg-violet-50 px-3 py-1"
            >
              <span className="text-sm font-semibold text-violet-900" aria-live="polite">
                Selected: {selectedLeads.length} Cold lead{selectedLeads.length === 1 ? '' : 's'}
              </span>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="rounded-lg px-2 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/70"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => {
                  setAssignLeads(selectedLeads);
                  setAssignOpen(true);
                }}
                className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg bg-violet-600 px-3 text-sm font-semibold text-white transition hover:bg-violet-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/70"
              >
                <Headphones className="h-4 w-4" aria-hidden="true" />
                Assign to Cold Calling
              </button>
            </div>
          ) : (
            <div className="mb-2 flex min-h-[44px] items-center justify-between gap-2 px-1">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
                {bucket ? `${STATUS_THEME[bucket].label} leads` : 'All assigned leads'}
              </h2>
              {data && (
                <span className="text-sm text-slate-500">
                  <span className="font-semibold text-slate-800">{formatCount(data.pagination.total)}</span>{' '}
                  Lead{data.pagination.total === 1 ? '' : 's'}
                </span>
              )}
            </div>
          )}

          <ExecutiveLeadsList
            selection={selection}
            leads={pageLeads}
            loading={isPending}
            emptyMessage={
              bucket
                ? `No ${STATUS_THEME[bucket].label.toLowerCase()} leads for this executive in the selected period.`
                : 'No leads were assigned to this executive in the selected period.'
            }
          />

          {data && data.pagination.total > 0 && (
            <TablePagination
              pageIndex={pageIndex}
              pageSize={PAGE_SIZE}
              pageCount={data.pagination.totalPages || 1}
              total={data.pagination.total}
              onPageChange={setPageIndex}
              totalLabel="leads"
              accent="violet"
            />
          )}
        </>
      )}

      <AssignColdCallingModal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        executive={executive}
        leads={assignLeads}
        onAssigned={() => {
          setAssignOpen(false);
          setSelectedIds([]);
        }}
      />
    </div>
  );
}
