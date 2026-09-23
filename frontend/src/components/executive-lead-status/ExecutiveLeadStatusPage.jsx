import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, Headphones, Info, RefreshCw, Users } from 'lucide-react';
import ColdCallingAnalyticsView from '../cold-calling-analytics/ColdCallingAnalyticsView';
import { COLD_CALLING_VIEW, switchAnalyticsView } from '../../lib/coldCallingAnalytics';
import ExecutiveLeadStatusFilters from './ExecutiveLeadStatusFilters';
import ExecutiveLeadStatusTable from './ExecutiveLeadStatusTable';
import StatusSummaryCard from './StatusSummaryCard';
import { STATUS_ORDER } from './statusTheme';
import { useExecutiveLeadStatusQuery } from '../../features/leads/hooks/useExecutiveLeadStatusQuery';
import {
  buildExecutiveDetailPath,
  createDefaultExecutiveLeadStatusFilters,
  describeAssignmentPeriod,
  filtersFromSearchParams,
  filtersToSearchParams,
  formatCount,
} from '../../lib/executiveLeadStatusFilters';
import { applyPeriodPreset } from '../../lib/periodFilters';
import { cn } from '../../lib/utils';

/** The Sales Executives report — unchanged; the tab wrapper below only decides whether to show it. */
function SalesExecutivesView() {
  // The applied filters live in the URL: a drill-down keeps them, and browser Back restores them.
  const [searchParams, setSearchParams] = useSearchParams();
  const appliedFilters = useMemo(() => filtersFromSearchParams(searchParams), [searchParams]);
  const [filters, setFilters] = useState(appliedFilters);
  useEffect(() => setFilters(appliedFilters), [appliedFilters]);

  const query = useExecutiveLeadStatusQuery(appliedFilters);
  const { data, isPending, isError, error, isFetching, refetch } = query;

  const applyFilters = (next) => setSearchParams(filtersToSearchParams(next), { replace: true });
  const handlePeriodSelect = (key) => applyFilters({ ...filters, ...applyPeriodPreset(key) });
  const handleReset = () => applyFilters(createDefaultExecutiveLeadStatusFilters());

  const rows = data?.executives ?? [];
  const errorMessage = error?.response?.data?.message || error?.message || 'Something went wrong.';

  return (
    <div className="animate-fade-up px-4 pt-4 lg:px-0 lg:pt-0">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[26px]">Executive Lead Status</h1>
          <p className="mt-1 text-sm text-slate-500">
            Assigned leads per Sales Executive, split by Cold, Warm, Hot and Unclassified. Select an executive to see their leads.
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
          Refresh
        </button>
      </div>

      <ExecutiveLeadStatusFilters
        filters={filters}
        onChange={setFilters}
        onApply={() => applyFilters(filters)}
        onReset={handleReset}
        onPeriodSelect={handlePeriodSelect}
      />

      {isError ? (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50/60 px-4 py-12 text-center">
          <AlertTriangle className="h-8 w-8 text-rose-500" />
          <p className="text-sm font-semibold text-rose-800">Couldn&apos;t load Executive Lead Status</p>
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
          <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
            {STATUS_ORDER.map((status) => (
              <StatusSummaryCard
                key={status}
                status={status}
                value={data?.totals?.[status]}
                loading={isPending}
                className={status === 'assigned' ? 'col-span-2 sm:col-span-1' : undefined}
              />
            ))}
          </div>

          <p className="mb-2 text-xs text-slate-500">
            Assigned period: <span className="font-semibold text-slate-700">{describeAssignmentPeriod(appliedFilters)}</span>
            {' '}(IST)
          </p>

          <ExecutiveLeadStatusTable
            rows={rows}
            totals={data?.totals}
            loading={isPending}
            refreshing={isFetching && !isPending}
            detailPathFor={(row) => buildExecutiveDetailPath(row._id, appliedFilters)}
          />

          {data?.otherOwnersAssigned > 0 && (
            <p className="mt-2 text-xs text-slate-500">
              {formatCount(data.otherOwnersAssigned)} lead{data.otherOwnersAssigned === 1 ? ' is' : 's are'} assigned to
              team leaders or managers in this period and not listed above.
            </p>
          )}

          <p className="mt-3 flex items-start gap-1.5 text-xs text-slate-500">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Assigned = leads currently owned by the executive whose assignment date falls in the period. Cold / Warm /
              Hot follow the Lead Status filter; converted leads and leads with no matching status are Unclassified.
            </span>
          </p>
        </>
      )}
    </div>
  );
}

const TABS = [
  { view: 'sales', label: 'Sales Executives', icon: Users },
  { view: COLD_CALLING_VIEW, label: 'Cold Calling', icon: Headphones },
];

/**
 * Executive Lead Status: `?view=cold-calling` shows the Cold Calling analytics, anything else the existing
 * Sales Executives report. Switching keeps the period / source / branch in the URL.
 */
export default function ExecutiveLeadStatusPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get('view') === COLD_CALLING_VIEW ? COLD_CALLING_VIEW : 'sales';

  return (
    <div>
      <div className="px-4 pt-4 lg:px-0 lg:pt-0">
      <div role="tablist" aria-label="Report" className="mb-4 inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
        {TABS.map(({ view: tabView, label, icon: Icon }) => {
          const selected = view === tabView;
          return (
            <button
              key={tabView}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => !selected && setSearchParams(switchAnalyticsView(searchParams, tabView))}
              className={cn(
                'inline-flex h-9 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60',
                selected ? 'bg-white text-violet-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </div>
      </div>
      {view === COLD_CALLING_VIEW ? (
        <div className="animate-fade-up px-4 lg:px-0">
          <ColdCallingAnalyticsView />
        </div>
      ) : (
        <SalesExecutivesView />
      )}
    </div>
  );
}
