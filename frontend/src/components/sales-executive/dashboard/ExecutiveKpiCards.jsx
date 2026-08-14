import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Users,
  Sparkles,
  Phone,
  CalendarClock,
  Clock3,
  Flame,
  IndianRupee,
  Loader,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { formatCurrency } from '../executiveUtils';

/** Primary lead KPIs — compact single-row strip */
const cards = [
  { key: 'myLeads', label: 'Total Leads', short: 'Total', icon: Users, iconBg: 'bg-violet-100 text-violet-600', path: '/sales-executive/leads/all' },
  { key: 'todayLeads', label: 'Fresh / Today', short: 'Fresh', icon: Sparkles, iconBg: 'bg-sky-100 text-sky-600', path: '/sales-executive/leads/new' },
  { key: 'connectedLeads', label: 'Connected', short: 'Connected', icon: Phone, iconBg: 'bg-emerald-100 text-emerald-600', path: '/sales-executive/leads/contacted' },
  { key: 'workingProgress', label: 'Work in Progress', short: 'WIP', icon: Loader, iconBg: 'bg-orange-100 text-orange-600', path: '/sales-executive/leads/working-progress' },
  { key: 'followUpPending', label: 'F/U Pending', short: 'F/U Pend.', icon: Clock3, iconBg: 'bg-amber-100 text-amber-600', path: '/sales-executive/follow-ups' },
  { key: 'todayFollowups', label: "Today's F/U", short: "Today's F/U", icon: CalendarClock, iconBg: 'bg-blue-100 text-blue-600', path: '/sales-executive/follow-ups' },
  { key: 'hotLeads', label: 'Hot Leads', short: 'Hot', icon: Flame, iconBg: 'bg-rose-100 text-rose-600', path: '/sales-executive/leads/hot' },
  { key: 'monthlyRevenue', label: 'Revenue', short: 'Revenue', icon: IndianRupee, iconBg: 'bg-emerald-100 text-emerald-600', format: formatCurrency, path: '/sales-executive/quotations' },
];

function TrendBadge({ trend }) {
  if (!trend) return <span className="truncate text-[8px] text-content-muted">Live</span>;
  const { change, period } = trend;
  const isUp = change > 0;
  const isDown = change < 0;
  const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;
  const colorClass = isUp
    ? 'text-emerald-600'
    : isDown
      ? 'text-rose-600'
      : 'text-content-muted';

  return (
    <p className={`mt-0.5 flex min-w-0 items-center gap-0.5 text-[8px] font-medium ${colorClass}`}>
      <Icon className="h-2.5 w-2.5 shrink-0" />
      <span className="truncate">{Math.abs(change)}% {period}</span>
    </p>
  );
}

export default function ExecutiveKpiCards({ kpis, trends }) {
  if (!kpis) return null;

  return (
    <div className="grid grid-cols-4 gap-1.5 xl:grid-cols-8">
      {cards.map(({ key, label, short, icon: Icon, iconBg, format, path }, i) => {
        const value = kpis[key];
        const Wrapper = path ? Link : 'div';

        return (
          <motion.div
            key={key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className="min-w-0"
            title={label}
          >
            <Wrapper
              {...(path ? { to: path } : {})}
              className="flex h-full min-h-0 cursor-pointer flex-col gap-1 rounded-lg border border-subtle bg-white px-1.5 py-1.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-900/80 sm:flex-row sm:items-center sm:gap-1.5 sm:px-2 sm:py-2"
            >
              <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${iconBg} sm:h-7 sm:w-7`}>
                <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[8px] font-bold uppercase tracking-wide text-content-muted sm:text-[9px]">
                  <span className="sm:hidden">{short}</span>
                  <span className="hidden sm:inline">{label}</span>
                </p>
                <p className="truncate text-sm font-bold leading-tight text-content-primary sm:text-base">
                  {format ? format(value) : (value ?? 0)}
                </p>
                <TrendBadge trend={trends?.[key]} />
              </div>
            </Wrapper>
          </motion.div>
        );
      })}
    </div>
  );
}
