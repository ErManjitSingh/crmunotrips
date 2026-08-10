import { lazy, Suspense, useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Info } from "lucide-react";
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
    <div className="h-52 animate-pulse rounded-2xl border border-subtle bg-surface sm:h-56" />
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const isLeadProvider = user?.role === "lead_provider";
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState(getDefaultDashboardFilters);
  const {
    data: stats,
    isLoading,
    isFetching,
  } = useDashboardQuery("/dashboard/stats", filters);

  const refreshDashboard = useCallback(async () => {
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

  useDataRefresh(["dashboard"], refreshDashboard);

  const report = stats?.report;
  const generatedAt = useMemo(() => {
    const raw = report?.generatedAt || new Date().toISOString();
    return new Date(raw).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [report?.generatedAt]);

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

      <div className="mx-auto hidden w-full max-w-[1600px] space-y-4 pb-8 sm:space-y-5 lg:block">
        {isFetching && (
          <div className="h-0.5 w-full overflow-hidden rounded-full bg-violet-500/30">
            <div className="h-full w-1/3 animate-pulse bg-violet-500" />
          </div>
        )}

        <DashboardHeader
          filters={filters}
          onFiltersChange={setFilters}
          onRefresh={refreshDashboard}
          isRefreshing={isFetching}
          periodLabel={report?.period?.label}
          badgeLabel={isLeadProvider ? "Lead Insights" : "Admin Insights"}
        />

        <AdminDashboardGreeting
          filters={filters}
          periodLabel={report?.period?.label}
        />

        <DashboardHero stats={stats} />

        {!isLeadProvider && (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <div className="min-w-0 xl:col-span-3">
              <ActionRequiredPanel items={actionRequired} />
            </div>
            <div className="min-w-0 xl:col-span-5">
              <AdminSalesFunnel data={funnel} />
            </div>
            <div className="min-w-0 xl:col-span-4">
              <LeadSourcePerformanceTable data={sourceRows} />
            </div>
          </div>
        )}

        <div
          className={
            isLeadProvider
              ? "grid grid-cols-1 gap-4 md:grid-cols-2"
              : "grid grid-cols-1 gap-4 xl:grid-cols-12"
          }
        >
          <div className="min-w-0 xl:col-span-5">
            <Suspense fallback={<PanelSkeleton />}>
              <LeadTrendChart stats={stats} />
            </Suspense>
          </div>
          <div className="min-w-0 xl:col-span-3">
            <TopDestinationsDonut data={report?.topDestinations || []} />
          </div>
          {!isLeadProvider && (
            <div className="min-w-0 xl:col-span-4">
              <SalesTeamPerformanceTable data={stats.executivePerformance} />
            </div>
          )}
        </div>

        {!isLeadProvider && <FinancialMetricsRow financials={financials} />}

        <div className="flex flex-col gap-2 border-t border-subtle pt-4 text-xs text-content-muted sm:flex-row sm:items-center sm:justify-between">
          <p className="inline-flex items-start gap-1.5 sm:items-center">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 sm:mt-0" />
            Live CRM metrics. Pipeline keeps Contacted and Qualified separate.
            Currency in INR.
          </p>
          <p className="shrink-0">Report Generated on: {generatedAt}</p>
        </div>
      </div>
    </>
  );
}
