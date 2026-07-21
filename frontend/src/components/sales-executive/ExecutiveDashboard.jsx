import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { CalendarDays, Moon, Rocket, Sparkles, Sun, Target } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useDataRefresh } from '../../hooks/useDataRefresh';
import { useDashboardQuery } from '../../features/dashboard/hooks/useDashboardQuery';
import { invalidateDashboard } from '../../lib/queryInvalidation';
import { fetchAnnouncementFeed } from '../../services/announcementApi';
import ExecutiveKpiCards from './dashboard/ExecutiveKpiCards';
import ExecutiveDashboardPanels from './dashboard/ExecutiveDashboardPanels';
import MobileExecutiveDashboard from './dashboard/MobileExecutiveDashboard';

function getGreeting(hour) {
  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatTodayDate(date) {
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function getTimeScene(hour) {
  if (hour >= 5 && hour < 12) {
    return {
      id: 'morning',
      label: 'Morning',
      wrapper: 'border-amber-200/70 bg-gradient-to-r from-amber-100 via-orange-50 to-sky-100 text-slate-800',
      muted: 'text-slate-600',
      date: 'border-white/70 bg-white/60 text-slate-700',
      icon: 'bottom-[-14px] right-10 text-amber-400',
    };
  }
  if (hour >= 12 && hour < 17) {
    return {
      id: 'afternoon',
      label: 'Afternoon',
      wrapper: 'border-sky-200/70 bg-gradient-to-r from-sky-100 via-blue-50 to-cyan-100 text-slate-800',
      muted: 'text-slate-600',
      date: 'border-white/70 bg-white/60 text-slate-700',
      icon: 'right-[28%] top-1 text-amber-400',
    };
  }
  return {
    id: 'night',
    label: 'Evening',
    wrapper: 'border-indigo-800/60 bg-gradient-to-r from-slate-950 via-indigo-950 to-violet-900 text-white',
    muted: 'text-indigo-100/75',
    date: 'border-white/15 bg-white/10 text-white',
    icon: 'right-12 top-2 text-amber-100',
  };
}

function TimeScene({ scene }) {
  if (scene.id === 'night') {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {[
          ['12%', '24%'], ['22%', '70%'], ['42%', '18%'], ['57%', '72%'],
          ['68%', '28%'], ['79%', '67%'], ['91%', '22%'],
        ].map(([left, top], index) => (
          <Sparkles
            key={`${left}-${top}`}
            className="absolute h-2.5 w-2.5 animate-pulse text-white/70"
            style={{ left, top, animationDelay: `${index * 220}ms` }}
          />
        ))}
        <motion.div
          key={scene.id}
          initial={{ opacity: 0, scale: 0.7, rotate: -20 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          className={`absolute ${scene.icon}`}
        >
          <Moon className="h-14 w-14 fill-current drop-shadow-[0_0_18px_rgba(254,249,195,0.45)]" />
        </motion.div>
      </div>
    );
  }

  return (
    <motion.div
      key={scene.id}
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`pointer-events-none absolute ${scene.icon}`}
      aria-hidden
    >
      <Sun className="h-16 w-16 fill-current drop-shadow-[0_0_20px_rgba(251,191,36,0.5)]" />
    </motion.div>
  );
}

export default function ExecutiveDashboard() {
  const [now, setNow] = useState(() => new Date());
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading, isFetching } = useDashboardQuery('/sales-executive/dashboard');
  const { data: announcementFeed } = useQuery({
    queryKey: ['announcements', 'feed'],
    queryFn: fetchAnnouncementFeed,
    staleTime: 120_000,
  });
  const firstName = user?.name?.trim().split(' ')[0] || 'Sales';
  const scene = getTimeScene(now.getHours());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

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
    <>
      <MobileExecutiveDashboard
        data={data}
        hero={hero}
        firstName={firstName}
        greeting={getGreeting(now.getHours())}
        now={now}
        unreadCount={announcementFeed?.unreadCount || 0}
      />

      <div className="hidden space-y-3 pb-6 lg:block">
      {isFetching && (
        <div className="h-0.5 w-full bg-violet-500/30 rounded-full overflow-hidden">
          <div className="h-full w-1/3 bg-violet-500 animate-pulse" />
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className={`relative min-h-[78px] overflow-hidden rounded-xl border px-4 py-3 shadow-sm transition-colors duration-1000 ${scene.wrapper}`}
      >
        <TimeScene scene={scene} />
        <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
              {getGreeting(now.getHours())}, {firstName}! 👋
            </h1>
            <p className={`mt-0.5 text-xs ${scene.muted}`}>
              Here&apos;s what&apos;s happening with your leads today.
            </p>
          </div>
          <div className={`inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium backdrop-blur-sm ${scene.date}`}>
            <CalendarDays className="h-3.5 w-3.5" />
            <span>{formatTodayDate(now)}</span>
            <span className="opacity-50">·</span>
            <span>{now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
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
    </>
  );
}
