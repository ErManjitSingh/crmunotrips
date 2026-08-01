import { lazy, Suspense, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useDataRefresh } from '../../hooks/useDataRefresh';
import { useDashboardQuery } from '../../features/dashboard/hooks/useDashboardQuery';
import { invalidateDashboard } from '../../lib/queryInvalidation';
import PageHeader from '../ui/PageHeader';
import ManagerDashboardHero from './dashboard/ManagerDashboardHero';
import ManagerKpiCards from './dashboard/ManagerKpiCards';
import ManagerQuickActions from './dashboard/ManagerQuickActions';
import ManagerDashboardPanels from './dashboard/ManagerDashboardPanels';

const ManagerCharts = lazy(() => import('./dashboard/ManagerCharts'));

function ChartSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="h-64 rounded-2xl bg-slate-100 animate-pulse" />
      <div className="h-64 rounded-2xl bg-slate-100 animate-pulse" />
    </div>
  );
}

export default function ManagerDashboard() {
  const queryClient = useQueryClient();
  const { data, isLoading, isFetching } = useDashboardQuery('/sales-manager/dashboard');

  const refresh = useCallback(() => {
    invalidateDashboard(queryClient);
  }, [queryClient]);

  useDataRefresh(['dashboard'], refresh);

  if (isLoading && !data) {
    return (
      <div className="flex justify-center py-32">
        <div className="w-9 h-9 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      {isFetching && (
        <div className="h-0.5 w-full bg-violet-500/30 rounded-full overflow-hidden">
          <div className="h-full w-1/3 bg-violet-500 animate-pulse" />
        </div>
      )}

      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <PageHeader
          title="Sales Manager Command Center"
          description="Team pipeline, approvals, and performance at a glance"
          breadcrumbs={['Sales Manager', 'Dashboard']}
        />
      </motion.div>

      <ManagerDashboardHero
        pendingFollowups={data?.kpis?.pendingFollowups ?? 0}
        newLeadsToday={data?.kpis?.newLeadsToday ?? 0}
        pendingQuotes={data?.pendingApprovals?.length || 0}
      />

      <ManagerKpiCards kpis={data?.kpis} />

      <Suspense fallback={<ChartSkeleton />}>
        <ManagerCharts data={data} />
      </Suspense>

      <ManagerQuickActions />

      <ManagerDashboardPanels data={data} />
    </div>
  );
}
