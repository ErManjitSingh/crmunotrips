import { lazy, Suspense, useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Info } from 'lucide-react';
import API from '../api/axios';
import { useDataRefresh } from '../hooks/useDataRefresh';
import {
  useDashboardQuery,
  buildDashboardParams,
  dashboardQueryKey,
} from '../features/dashboard/hooks/useDashboardQuery';
import { invalidateDashboard } from '../lib/queryInvalidation';
import DashboardHeader, {
  getDefaultDashboardFilters,
} from '../components/dashboard/DashboardHeader';
import {
  DashboardHero,
  DashboardSkeleton,
} from '../components/dashboard';

const LeadTrendChart = lazy(() => import('../components/dashboard/LeadTrendChart'));
const LeadStatusDonut = lazy(() => import('../components/dashboard/LeadStatusDonut'));
const LeadSourceChart = lazy(() => import('../components/dashboard/LeadSourceChart'));
const ConversionRateChart = lazy(() => import('../components/dashboard/ConversionRateChart'));
const ExecutivePerformancePanel = lazy(() =>
  import('../components/dashboard/ExecutivePerformancePanel')
);
const RevenueVsBookingsChart = lazy(() =>
  import('../components/dashboard/RevenueVsBookingsChart')
);
const TodayFollowUps = lazy(() => import('../components/dashboard/TodayFollowUps'));
const RemindersAlertsPanel = lazy(() => import('../components/dashboard/RemindersAlertsPanel'));

function PanelSkeleton() {
  return <div className="h-52 animate-pulse rounded-2xl border border-subtle bg-surface sm:h-56" />;
}

export default function Dashboard() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState(getDefaultDashboardFilters);
  const { data: stats, isLoading, isFetching } = useDashboardQuery('/dashboard/stats', filters);

  const refreshDashboard = useCallback(async () => {
    const endpoint = '/dashboard/stats';
    const key = dashboardQueryKey(endpoint, filters);
    await invalidateDashboard(queryClient);
    await queryClient.invalidateQueries({ queryKey: ['nav-counts'] });
    await queryClient.fetchQuery({
      queryKey: key,
      queryFn: async () => {
        const { data } = await API.get(endpoint, {
          params: buildDashboardParams(filters, { fresh: true }),
          skipSuccessToast: true,
        });
        return data;
      },
    });
  }, [queryClient, filters]);

  useDataRefresh(['dashboard'], refreshDashboard);

  const report = stats?.report;
  const generatedAt = useMemo(() => {
    const raw = report?.generatedAt || new Date().toISOString();
    return new Date(raw).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [report?.generatedAt]);

  if (isLoading && !stats) return <DashboardSkeleton />;
  if (!stats) return null;

  const statusTotal = (report?.statusDistribution || []).reduce((s, d) => s + (d.value || 0), 0);
  const sourceTotal =
    stats.totalLeads ||
    (report?.leadsBySource || []).reduce((s, d) => s + (d.value || 0), 0);

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-4 pb-8 sm:space-y-5">
      {isFetching && (
        <div className="h-0.5 w-full overflow-hidden rounded-full bg-blue-500/30">
          <div className="h-full w-1/3 animate-pulse bg-blue-500" />
        </div>
      )}

      <DashboardHeader
        filters={filters}
        onFiltersChange={setFilters}
        onRefresh={refreshDashboard}
        isRefreshing={isFetching}
        periodLabel={report?.period?.label}
      />

      <DashboardHero stats={stats} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-5">
          <Suspense fallback={<PanelSkeleton />}>
            <LeadTrendChart stats={stats} />
          </Suspense>
        </div>
        <div className="min-w-0 lg:col-span-1 xl:col-span-3">
          <Suspense fallback={<PanelSkeleton />}>
            <LeadStatusDonut data={report?.statusDistribution || []} total={statusTotal} />
          </Suspense>
        </div>
        <div className="min-w-0 lg:col-span-2 xl:col-span-4">
          <Suspense fallback={<PanelSkeleton />}>
            <LeadSourceChart
              data={report?.leadsBySource || stats.leadSourceAnalytics || []}
              total={sourceTotal}
            />
          </Suspense>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Suspense fallback={<PanelSkeleton />}>
          <ConversionRateChart data={report?.conversionRateTrend || []} />
        </Suspense>
        <Suspense fallback={<PanelSkeleton />}>
          <ExecutivePerformancePanel data={stats.executivePerformance} />
        </Suspense>
        <div className="md:col-span-2 xl:col-span-1">
          <Suspense fallback={<PanelSkeleton />}>
            <RevenueVsBookingsChart data={report?.revenueVsBookings || []} />
          </Suspense>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Suspense fallback={<PanelSkeleton />}>
          <TodayFollowUps followups={stats.todayFollowUps || []} />
        </Suspense>
        <Suspense fallback={<PanelSkeleton />}>
          <RemindersAlertsPanel stats={stats} />
        </Suspense>
      </div>

      <div className="flex flex-col gap-2 border-t border-subtle pt-4 text-xs text-content-muted sm:flex-row sm:items-center sm:justify-between">
        <p className="inline-flex items-start gap-1.5 sm:items-center">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 sm:mt-0" />
          All metrics use live CRM data. % change compares with previous period. Currency in INR. L = Lakhs.
        </p>
        <p className="shrink-0">Report Generated on: {generatedAt}</p>
      </div>
    </div>
  );
}
