import { Suspense, useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Info } from 'lucide-react';
import { useDataRefresh } from '../hooks/useDataRefresh';
import { useDashboardQuery } from '../features/dashboard/hooks/useDashboardQuery';
import { invalidateDashboard } from '../lib/queryInvalidation';
import DashboardHeader, {
  getDefaultDashboardFilters,
} from '../components/dashboard/DashboardHeader';
import {
  DashboardHero,
  DashboardSkeleton,
  TodayFollowUps,
  ExecutivePerformancePanel,
  LeadSourceChart,
  LeadTrendChart,
  RemindersAlertsPanel,
} from '../components/dashboard';
import LeadStatusDonut from '../components/dashboard/LeadStatusDonut';
import ConversionRateChart from '../components/dashboard/ConversionRateChart';
import RevenueVsBookingsChart from '../components/dashboard/RevenueVsBookingsChart';
import KeyHighlightsStrip from '../components/dashboard/KeyHighlightsStrip';

function PanelSkeleton() {
  return <div className="h-56 animate-pulse rounded-2xl border border-subtle bg-surface" />;
}

export default function Dashboard() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState(getDefaultDashboardFilters);
  const { data: stats, isLoading, isFetching, refetch } = useDashboardQuery('/dashboard/stats', filters);

  const refreshDashboard = useCallback(() => {
    invalidateDashboard(queryClient);
    refetch();
  }, [queryClient, refetch]);

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
  const sourceTotal = stats.totalLeads || (report?.leadsBySource || []).reduce((s, d) => s + (d.value || 0), 0);

  return (
    <div className="space-y-5 pb-8">
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

      <KeyHighlightsStrip highlights={report?.keyHighlights} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-5">
          <LeadTrendChart stats={stats} />
        </div>
        <div className="xl:col-span-3">
          <Suspense fallback={<PanelSkeleton />}>
            <LeadStatusDonut data={report?.statusDistribution || []} total={statusTotal} />
          </Suspense>
        </div>
        <div className="xl:col-span-4">
          <Suspense fallback={<PanelSkeleton />}>
            <LeadSourceChart data={report?.leadsBySource || stats.leadSourceAnalytics || []} total={sourceTotal} />
          </Suspense>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Suspense fallback={<PanelSkeleton />}>
          <ConversionRateChart data={report?.conversionRateTrend || []} />
        </Suspense>
        <Suspense fallback={<PanelSkeleton />}>
          <ExecutivePerformancePanel data={stats.executivePerformance} />
        </Suspense>
        <Suspense fallback={<PanelSkeleton />}>
          <RevenueVsBookingsChart data={report?.revenueVsBookings || []} />
        </Suspense>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
          All metrics are compared with previous period. Currency in INR. L = Lakhs.
        </p>
        <p>Report Generated on: {generatedAt}</p>
      </div>
    </div>
  );
}
