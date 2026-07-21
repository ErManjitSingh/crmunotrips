import { Link } from 'react-router-dom';
import { CalendarClock, Flame, Target } from 'lucide-react';
import { useSidebar } from '../../context/SidebarContext';
import { useDashboardQuery } from '../../features/dashboard/hooks/useDashboardQuery';

const INFO_ITEMS = [
  {
    key: 'todayFollowups',
    label: 'Follow-ups Today',
    icon: CalendarClock,
    iconClass: 'bg-violet-500',
    path: '/sales-executive/follow-ups',
  },
  {
    key: 'hotLeads',
    label: 'Hot Leads',
    icon: Flame,
    iconClass: 'bg-orange-500',
    path: '/sales-executive/leads/hot',
  },
];

export default function ExecutiveSidebarFooter() {
  const { collapsed, setMobileOpen } = useSidebar();
  const { data, isLoading } = useDashboardQuery('/sales-executive/dashboard', {}, {
    enabled: !collapsed,
  });

  if (collapsed) return null;

  const kpis = data?.kpis || {};
  const targetProgress = Math.min(100, Math.max(0, Number(data?.target?.progress || 0)));

  return (
    <div className="border-t border-white/15 px-3 py-3">
      <div className="rounded-2xl border border-white/15 bg-black/20 p-3 shadow-lg backdrop-blur-md">
        <div className="mb-2.5 flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white">
            Quick Info
          </p>
          <span className="h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-emerald-400/20" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          {INFO_ITEMS.map(({ key, label, icon: Icon, iconClass, path }) => (
            <Link
              key={key}
              to={path}
              onClick={() => setMobileOpen(false)}
              className="rounded-xl border border-white/10 bg-white/10 p-2 transition hover:bg-white/15"
            >
              <div className={`mb-1.5 flex h-6 w-6 items-center justify-center rounded-lg ${iconClass}`}>
                <Icon className="h-3.5 w-3.5 text-white" />
              </div>
              <p className="text-lg font-bold leading-none text-white">
                {isLoading ? '—' : (kpis[key] ?? 0)}
              </p>
              <p className="mt-1 text-[9px] font-medium leading-tight text-white">{label}</p>
            </Link>
          ))}
        </div>

        <Link
          to="/sales-executive/dashboard"
          onClick={() => setMobileOpen(false)}
          className="mt-2.5 block rounded-xl border border-white/10 bg-white/10 p-2.5 transition hover:bg-white/15"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[10px] font-semibold text-white">
              <Target className="h-3.5 w-3.5" />
              Monthly Target
            </span>
            <span className="text-[11px] font-bold text-white">{targetProgress}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-300 to-orange-400 transition-all"
              style={{ width: `${targetProgress}%` }}
            />
          </div>
        </Link>
      </div>
    </div>
  );
}
