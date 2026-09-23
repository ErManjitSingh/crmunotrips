import { useEffect, useMemo, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Info, RefreshCw } from 'lucide-react';
import AnalyticsKpiCards from './AnalyticsKpiCards';
import AgentPerformanceTable from './AgentPerformanceTable';
import CallOutcomesCard from './CallOutcomesCard';
import ColdCallingFilters from './ColdCallingFilters';
import StatusDistributionCard from './StatusDistributionCard';
import StatusMovementCard from './StatusMovementCard';
import { useColdCallingAnalyticsQuery } from '../../features/leads/hooks/useColdCallingAnalyticsQuery';
import {
  buildColdCallingAgentPath,
  buildKpiCards,
  coldCallingFiltersFromSearchParams,
  coldCallingFiltersToSearchParams,
  createDefaultColdCallingFilters,
} from '../../lib/coldCallingAnalytics';
import { describeAssignmentPeriod } from '../../lib/executiveLeadStatusFilters';
import { applyPeriodPreset } from '../../lib/periodFilters';
import { cn } from '../../lib/utils';

/**
 * The "Cold Calling" tab of Executive Lead Status. Filters live in the URL (so a drill-down keeps them and
 * Back restores them); the server returns every figure for those filters in ONE response, and this view only
 * lays it out.
 */
export default function ColdCallingAnalyticsView() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const appliedFilters = useMemo(() => coldCallingFiltersFromSearchParams(searchParams), [searchParams]);
  const [filters, setFilters] = useState(appliedFilters);
  useEffect(() => setFilters(appliedFilters), [appliedFilters]);

  const { data, isPending, isError, error, isFetching, refetch } = useColdCallingAnalyticsQuery(appliedFilters);

  const applyFilters = (next) => setSearchParams(coldCallingFiltersToSearchParams(next), { replace: true });
  const handlePeriodSelect = (key) => applyFilters({ ...filters, ...applyPeriodPreset(key) });
  const handleReset = () => applyFilters(createDefaultColdCallingFilters());

  const errorMessage = error?.response?.data?.message || error?.message || 'Something went wrong.';
  const summary = data?.summary;
  const assigned = summary?.assigned ?? 0;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[26px]">Cold Calling Analytics</h1>
          <p className="mt-1 text-sm text-slate-500">
            How leads sent to Cold Calling were worked, and what became of them. Select an agent to see their leads and calls.
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

      <ColdCallingFilters filters={filters} onChange={setFilters} onApply={() => applyFilters(filters)} onReset={handleReset} onPeriodSelect={handlePeriodSelect} />

      {isError ? (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50/60 px-4 py-12 text-center">
          <AlertTriangle className="h-8 w-8 text-rose-500" />
          <p className="text-sm font-semibold text-rose-800">Couldn&apos;t load Cold Calling analytics</p>
          <p className="max-w-md text-xs text-rose-700">{errorMessage}</p>
          <button type="button" onClick={() => refetch()} className="h-9 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white transition hover:bg-rose-700">
            Try again
          </button>
        </div>
      ) : (
        <>
          <AnalyticsKpiCards cards={buildKpiCards(summary)} loading={isPending} className="mb-4" />

          <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
            <StatusDistributionCard distribution={data?.statusDistribution} assigned={assigned} loading={isPending} />
            <StatusMovementCard movements={data?.statusMovements} assigned={assigned} loading={isPending} />
            <CallOutcomesCard outcomes={data?.callOutcomes} totalCalls={summary?.totalCalls ?? 0} loading={isPending} />
          </div>

          <AgentPerformanceTable
            agents={data?.agents}
            summary={summary}
            movements={data?.statusMovements}
            loading={isPending}
            refreshing={isFetching && !isPending}
            detailPathFor={(agent) => buildColdCallingAgentPath(agent._id, appliedFilters)}
            // The exact overview URL (including an agent filter), so Back from the agent page restores it.
            linkState={{ backTo: `${location.pathname}${location.search}` }}
          />

          <p className="mt-3 flex items-start gap-1.5 text-xs text-slate-500">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Period: leads assigned to Cold Calling on <span className="font-semibold text-slate-700">{describeAssignmentPeriod(appliedFilters)}</span> (IST). Worked = at
              least one Cold Calling call. Calls, movement and current status follow those leads afterwards. Total Cold Leads is the Sales pool (same
              population as the Sales Executives tab); it is not narrowed by agent.
            </span>
          </p>
        </>
      )}
    </div>
  );
}
