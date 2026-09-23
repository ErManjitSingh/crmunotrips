import { useMemo, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { AlertTriangle, ArrowLeft, CalendarRange, GitBranch, Megaphone } from 'lucide-react';
import AdminCallHistoryModal from './AdminCallHistoryModal';
import AgentLeadsTable from './AgentLeadsTable';
import AnalyticsKpiCards from './AnalyticsKpiCards';
import CallOutcomesCard from './CallOutcomesCard';
import RecentCallsCard from './RecentCallsCard';
import StatusDistributionCard from './StatusDistributionCard';
import StatusMovementCard from './StatusMovementCard';
import ExecutiveAvatar from '../executive-lead-status/ExecutiveAvatar';
import TablePagination from '../ui/TablePagination';
import { useColdCallingAgentLeadsQuery, useColdCallingAgentQuery } from '../../features/leads/hooks/useColdCallingAnalyticsQuery';
import {
  CATEGORY_LABELS,
  LEAD_CATEGORY_FILTERS,
  buildAgentKpiCards,
  buildColdCallingOverviewPath,
  coldCallingFiltersFromSearchParams,
  formatNumber,
  formatTalkTime,
} from '../../lib/coldCallingAnalytics';
import { describeAssignmentPeriod } from '../../lib/executiveLeadStatusFilters';
import { getLeadSourceShortLabel } from '../../lib/leadSourceLabels';
import { cn } from '../../lib/utils';

const PAGE_SIZE = 25;
const CATEGORY_KEYS = LEAD_CATEGORY_FILTERS.map((option) => option.value).filter(Boolean);

function ContextChip({ icon: Icon, children }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600">
      <Icon className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
      {children}
    </span>
  );
}

/**
 * /leads/executive-lead-status/cold-calling/:agentId — one Cold Calling agent for the same period / source /
 * branch the overview was showing (carried in the URL, so Back restores it). Overview figures, status,
 * movement, outcomes, recent calls, and the agent's leads (filterable by status and Worked / Unworked) with
 * each lead's complete call history one click away.
 */
export default function ColdCallingAgentDetailPage() {
  const { agentId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const filters = useMemo(() => coldCallingFiltersFromSearchParams(searchParams), [searchParams]);
  const categoryParam = searchParams.get('category');
  const category = CATEGORY_KEYS.includes(categoryParam) ? categoryParam : '';
  const activityParam = searchParams.get('activity');
  const activity = ['worked', 'unworked'].includes(activityParam) ? activityParam : '';
  const { availableBranches } = useSelector((state) => state.branch);

  // A different agent / filter set / lead filter is page 1 immediately (derived, never an effect that fires a stale page).
  const contextKey = `${agentId}|${searchParams}`;
  const [pageState, setPageState] = useState({ contextKey, index: 0 });
  const pageIndex = pageState.contextKey === contextKey ? pageState.index : 0;

  const [historyLead, setHistoryLead] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const overview = useColdCallingAgentQuery(agentId, filters);
  const leads = useColdCallingAgentLeadsQuery(agentId, filters, { category, activity, page: pageIndex + 1, limit: PAGE_SIZE });

  const setLeadFilter = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const { data, isPending, isError, error, refetch } = overview;
  const agent = data?.agent;
  const summary = data?.summary;
  const branchName = availableBranches.find((branch) => branch._id === filters.branchId)?.name;
  const errorMessage = error?.response?.data?.message || error?.message || 'Something went wrong.';
  const counts = Object.fromEntries((data?.statusDistribution ?? []).map((item) => [item.key, item.count]));

  return (
    <div className="animate-fade-up px-4 pt-4 lg:px-0 lg:pt-0">
      <Link
        to={location.state?.backTo || buildColdCallingOverviewPath(filters)}
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg text-sm font-semibold text-violet-700 transition hover:text-violet-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/70"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to Cold Calling Analytics
      </Link>

      {isError ? (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50/60 px-4 py-12 text-center">
          <AlertTriangle className="h-8 w-8 text-rose-500" />
          <p className="text-sm font-semibold text-rose-800">Couldn&apos;t load this Cold Calling agent</p>
          <p className="max-w-md text-xs text-rose-700">{errorMessage}</p>
          <button type="button" onClick={() => refetch()} className="h-9 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-700">Try again</button>
        </div>
      ) : (
        <>
          <header className="mb-4 flex flex-wrap items-center gap-4">
            <ExecutiveAvatar name={agent?.name} size="lg" />
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wide text-violet-600">Cold Calling Agent</p>
              {agent ? <h1 className="truncate text-2xl font-bold tracking-tight text-slate-900">{agent.name}</h1> : <div className="mt-1 h-7 w-48 animate-pulse rounded bg-slate-100" />}
              <p className="mt-0.5 text-sm text-slate-500">
                {summary ? (
                  <>
                    <span className="font-semibold text-slate-800">{formatNumber(summary.assigned)}</span> assigned ·{' '}
                    <span className="font-semibold text-slate-800">{formatTalkTime(summary.talkTimeSec)}</span> talk time
                    {agent?.active === false && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500">Inactive</span>}
                  </>
                ) : 'Loading…'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
              <ContextChip icon={CalendarRange}>{describeAssignmentPeriod(filters)} (IST)</ContextChip>
              {filters.source && <ContextChip icon={Megaphone}>{getLeadSourceShortLabel(filters.source)}</ContextChip>}
              {branchName && <ContextChip icon={GitBranch}>{branchName}</ContextChip>}
            </div>
          </header>

          <AnalyticsKpiCards cards={buildAgentKpiCards(summary)} loading={isPending} columns="lg:grid-cols-4" className="mb-4" />

          <div className="mb-5 grid grid-cols-1 gap-3 lg:grid-cols-3">
            <StatusDistributionCard distribution={data?.statusDistribution} assigned={summary?.assigned ?? 0} loading={isPending} />
            <StatusMovementCard movements={data?.statusMovements} assigned={summary?.assigned ?? 0} loading={isPending} />
            <CallOutcomesCard outcomes={data?.callOutcomes} totalCalls={summary?.totalCalls ?? 0} loading={isPending} />
            <RecentCallsCard calls={data?.recentCalls} loading={isPending} className="lg:col-span-3" />
          </div>

          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Leads</h2>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              Activity
              <select
                value={activity}
                onChange={(event) => setLeadFilter('activity', event.target.value)}
                className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-violet-500/25"
              >
                <option value="">All leads</option>
                <option value="worked">Worked (called)</option>
                <option value="unworked">Unworked (no calls)</option>
              </select>
            </label>
          </div>

          <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Filter leads by current status">
            {LEAD_CATEGORY_FILTERS.map((option) => {
              const selected = category === option.value;
              return (
                <button
                  key={option.value || 'all'}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setLeadFilter('category', option.value)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60',
                    selected ? 'border-violet-400 bg-violet-50 text-violet-800' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  )}
                >
                  {option.label}
                  {option.value && data && <span className="ml-1 text-slate-400">{formatNumber(counts[option.value] ?? 0)}</span>}
                </button>
              );
            })}
          </div>

          {leads.isError ? (
            <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50/60 px-4 py-10 text-center">
              <AlertTriangle className="h-7 w-7 text-rose-500" />
              <p className="text-sm font-semibold text-rose-800">Couldn&apos;t load this agent&apos;s leads</p>
              <button type="button" onClick={() => leads.refetch()} className="h-9 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-700">Try again</button>
            </div>
          ) : (
            <AgentLeadsTable
              rows={leads.data?.data ?? []}
              loading={leads.isPending}
              refreshing={leads.isFetching && !leads.isPending}
              onOpenHistory={(lead) => { setHistoryLead(lead); setHistoryOpen(true); }}
              emptyMessage={
                category || activity
                  ? `No ${category ? (CATEGORY_LABELS[category] || category).toLowerCase() : ''} ${activity || ''} leads for this agent in the selected period.`.replace(/\s+/g, ' ')
                  : 'No leads were assigned to this agent in the selected period.'
              }
            />
          )}

          {leads.data && leads.data.pagination.total > 0 && (
            <TablePagination
              pageIndex={pageIndex}
              pageSize={PAGE_SIZE}
              pageCount={leads.data.pagination.totalPages || 1}
              total={leads.data.pagination.total}
              onPageChange={(index) => setPageState({ contextKey, index })}
              totalLabel="leads"
              accent="violet"
            />
          )}
        </>
      )}

      <AdminCallHistoryModal open={historyOpen} lead={historyLead} onClose={() => setHistoryOpen(false)} />
    </div>
  );
}
