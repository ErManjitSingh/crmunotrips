import { lazy, Suspense, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Filter, Target, CalendarDays } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useDataRefresh } from '../../hooks/useDataRefresh';
import { useDashboardQuery } from '../../features/dashboard/hooks/useDashboardQuery';
import { invalidateDashboard } from '../../lib/queryInvalidation';
import ExecutiveKpiCards from './dashboard/ExecutiveKpiCards';
import ExecutiveDashboardPanels from './dashboard/ExecutiveDashboardPanels';

const AnnouncementCenter = lazy(() => import('../announcements/AnnouncementCenter'));

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatTodayDate() {
  return new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function ExecutiveDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading, isFetching } = useDashboardQuery('/sales-executive/dashboard');
  const firstName = user?.name?.trim().split(' ')[0] || 'Sales';

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

  const progress = data?.target?.progress ?? 0;

  return (
    <div className="space-y-6 pb-8">
      {isFetching && (
        <div className="h-0.5 w-full bg-violet-500/30 rounded-full overflow-hidden">
          <div className="h-full w-1/3 bg-violet-500 animate-pulse" />
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-content-primary tracking-tight">
            {getGreeting()}, {firstName}! 👋
          </h1>
          <p className="text-sm text-content-secondary mt-1">
            Here&apos;s what&apos;s happening with your leads today.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-subtle bg-white dark:bg-slate-900 shadow-sm text-sm font-medium text-content-secondary shrink-0">
          <CalendarDays className="w-4 h-4 text-violet-500" />
          {formatTodayDate()}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-violet-200/60 dark:border-violet-500/20 bg-gradient-to-r from-violet-50 via-purple-50/80 to-indigo-50/60 dark:from-violet-950/40 dark:via-purple-950/30 dark:to-indigo-950/20 p-5 sm:p-6"
      >
        <div className="absolute top-0 right-0 w-72 h-72 bg-violet-400/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-start gap-4 min-w-0">
            <div className="p-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20 shrink-0">
              <Filter className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400 mb-1">
                Your Pipeline
              </p>
              <h2 className="text-lg sm:text-xl font-bold text-content-primary leading-snug">
                {data?.kpis?.todayFollowups ?? 0} follow-ups today · {data?.kpis?.hotLeads ?? 0} hot leads need attention
              </h2>
              <p className="text-sm text-content-secondary mt-1">
                Focus on conversion — you&apos;re at {progress}% of monthly target
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0 sm:pl-4">
            <div className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/60 border border-violet-200/50 dark:border-violet-500/20">
              <Target className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div className="min-w-[100px]">
              <p className="text-2xl font-bold text-content-primary tabular-nums">{progress}%</p>
              <div className="h-1.5 rounded-full bg-violet-200/60 dark:bg-violet-900/40 mt-1.5 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(progress, 100)}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-500"
                />
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <Suspense fallback={null}>
        <AnnouncementCenter />
      </Suspense>

      <ExecutiveKpiCards kpis={data?.kpis} trends={data?.kpiTrends} />
      <ExecutiveDashboardPanels data={data} />
    </div>
  );
}
