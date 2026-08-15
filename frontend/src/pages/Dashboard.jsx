import { lazy, Suspense, useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import API from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { useDataRefresh } from "../hooks/useDataRefresh";
import {
  useDashboardQuery,
  buildDashboardParams,
  dashboardQueryKey,
} from "../features/dashboard/hooks/useDashboardQuery";
import { invalidateDashboard } from "../lib/queryInvalidation";
import DashboardHeader, {
  getDefaultDashboardFilters,
} from "../components/dashboard/DashboardHeader";
import {
  DashboardHero,
  DashboardSkeleton,
  AdminDashboardGreeting,
  ActionRequiredPanel,
  AdminSalesFunnel,
  LeadSourcePerformanceTable,
  TopDestinationsDonut,
  SalesTeamPerformanceTable,
  FinancialMetricsRow,
} from "../components/dashboard";

const MobileAdminDashboard = lazy(
  () => import("../components/dashboard/MobileAdminDashboard"),
);
const LeadTrendChart = lazy(
  () => import("../components/dashboard/LeadTrendChart"),
);

function PanelSkeleton() {
  return (
    <div className="h-56 animate-pulse rounded-2xl border border-slate-100 bg-white sm:h-64" />
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const isLeadProvider = user?.role === "lead_provider";
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState(getDefaultDashboardFilters);
  const [showFilters, setShowFilters] = useState(false);
  const {
    data: stats,
    isLoading,
    isFetching,
  } = useDashboardQuery("/dashboard/stats", filters);

  // Soft refresh after mutations — use Redis cache, do NOT send fresh=1 (that stampedes Mongo).
  const softRefreshDashboard = useCallback(() => {
    invalidateDashboard(queryClient);
  }, [queryClient]);

  // Manual / filter refresh only — bypasses server cache once.
  const hardRefreshDashboard = useCallback(async () => {
    const endpoint = "/dashboard/stats";
    const key = dashboardQueryKey(endpoint, filters);
    await invalidateDashboard(queryClient);
    await queryClient.invalidateQueries({ queryKey: ["nav-counts"] });
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

  useDataRefresh(["dashboard"], softRefreshDashboard);

  const report = stats?.report;

  if (isLoading && !stats) return <DashboardSkeleton />;
  if (!stats) return null;

  const funnel = report?.salesFunnel || stats.salesFunnel || [];
  const actionRequired = report?.actionRequired || stats.actionRequired || [];
  const financials = report?.financials || stats.financials || {};
  const sourceRows =
    report?.leadsBySource ||
    stats.leadSourceAnalytics ||
    stats.sourceAnalytics?.sources ||
    [];

  return (
    <>
      <div className="lg:hidden">
        <Suspense fallback={<DashboardSkeleton />}>
          <MobileAdminDashboard
            stats={stats}
            filters={filters}
            onFiltersChange={setFilters}
            isFetching={isFetching}
          />
        </Suspense>
      </div>

      <div className="mx-auto hidden w-full max-w-[1600px] space-y-5 pb-8 lg:block">
        {isFetching && (
          <div className="h-0.5 w-full overflow-hidden rounded-full bg-violet-500/30">
            <div className="h-full w-1/3 animate-pulse bg-violet-500" />
          </div>
        )}

        <AdminDashboardGreeting
          filters={filters}
          periodLabel={report?.period?.label}
          onOpenFilters={() => setShowFilters((v) => !v)}
        />

        {showFilters && (
          <DashboardHeader
            filters={filters}
            onFiltersChange={setFilters}
            onRefresh={hardRefreshDashboard}
            isRefreshing={isFetching}
            periodLabel={report?.period?.label}
            badgeLabel={isLeadProvider ? "Lead Insights" : "Admin Insights"}
          />
        )}

        <DashboardHero stats={stats} filters={filters} />

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
          {!isLeadProvider && (
            <div className="min-w-0 xl:col-span-3">
              <ActionRequiredPanel items={actionRequired} />
            </div>
          )}
          <div
            className={
              isLeadProvider ? "min-w-0 xl:col-span-7" : "min-w-0 xl:col-span-5"
            }
          >
            <AdminSalesFunnel data={funnel} />
          </div>
          <div
            className={
              isLeadProvider ? "min-w-0 xl:col-span-5" : "min-w-0 xl:col-span-4"
            }
          >
            <LeadSourcePerformanceTable data={sourceRows} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
          <div className="min-w-0 xl:col-span-5">
            <Suspense fallback={<PanelSkeleton />}>
              <LeadTrendChart stats={stats} />
            </Suspense>
          </div>
          <div className="min-w-0 xl:col-span-3">
            <TopDestinationsDonut data={report?.topDestinations || []} />
          </div>
          <div className="min-w-0 xl:col-span-4">
            <SalesTeamPerformanceTable
              data={stats.executivePerformance}
              filters={filters}
              periodLabel={report?.period?.label}
            />
          </div>
        </div>

        {!isLeadProvider && <FinancialMetricsRow financials={financials} />}
      </div>
    </>
  );
}
