import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { CalendarDays, Rocket, Target } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useDataRefresh } from '../../hooks/useDataRefresh';
import { useDashboardQuery } from '../../features/dashboard/hooks/useDashboardQuery';
import { invalidateDashboard } from '../../lib/queryInvalidation';
import { fetchAnnouncementFeed } from '../../services/announcementApi';
import ExecutiveKpiCards from './dashboard/ExecutiveKpiCards';
import ExecutiveDashboardPanels from './dashboard/ExecutiveDashboardPanels';

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
  const { data: announcementFeed } = useQuery({
    queryKey: ['announcements', 'feed'],
    queryFn: fetchAnnouncementFeed,
    staleTime: 120_000,
  });
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

  const progress = Math.min(100, data?.target?.progress ?? 0);
  const hero = announcementFeed?.hero;

  return (
    <div className="space-y-3 pb-6">
      {isFetching && (
        <div className="h-0.5 w-full bg-violet-500/30 rounded-full overflow-hidden">
          <div className="h-full w-1/3 bg-violet-500 animate-pulse" />
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
      >
        <div>
          <h1 className="text-xl font-bold tracking-tight text-content-primary sm:text-2xl">
            {getGreeting()}, {firstName}! 👋
          </h1>
          <p className="mt-0.5 text-xs text-content-secondary">
            Here&apos;s what&apos;s happening with your leads today.
          </p>
        </div>
        <div className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-subtle bg-white px-3 py-2 text-xs font-medium text-content-secondary shadow-sm dark:bg-slate-900">
          <CalendarDays className="h-3.5 w-3.5 text-violet-500" />
          {formatTodayDate()}
        </div>
      </motion.div>

      <ExecutiveKpiCards kpis={data?.kpis} trends={data?.kpiTrends} />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-500 to-rose-400 px-4 py-3.5 text-white shadow-lg shadow-violet-500/15"
      >
        <div className="absolute -right-12 -top-16 h-44 w-44 rounded-full bg-white/15 blur-2xl" />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
              <Rocket className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-wider text-amber-100">
                {hero?.badge || 'Monthly Goal'}
              </p>
              <h2 className="truncate text-sm font-bold sm:text-base">
                {hero?.title || `${data?.kpis?.todayFollowups ?? 0} follow-ups and ${data?.kpis?.hotLeads ?? 0} hot leads need attention`}
              </h2>
              <p className="mt-0.5 line-clamp-1 text-[11px] text-white/80">
                {hero?.description || `You are currently at ${progress}% of your monthly sales target.`}
              </p>
              <div className="mt-2 h-1.5 w-full max-w-md overflow-hidden rounded-full bg-black/20">
                <div className="h-full rounded-full bg-white" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2">
            <Target className="h-4 w-4" />
            <span className="text-lg font-bold">{progress}%</span>
          </div>
        </div>
      </motion.div>

      <ExecutiveDashboardPanels data={data} announcements={announcementFeed?.carousel || []} />
    </div>
  );
}
