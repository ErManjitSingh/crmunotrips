import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Users,
  Sparkles,
  Phone,
  CalendarClock,
  Flame,
  FileText,
  IndianRupee,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { formatCurrency } from '../executiveUtils';

/** Primary lead KPIs first: Total · Fresh (today) · Connected */
const cards = [
  { key: 'myLeads', label: 'Total Leads', icon: Users, iconBg: 'bg-violet-100 text-violet-600', path: '/sales-executive/leads/all' },
  { key: 'todayLeads', label: 'Fresh / Today', icon: Sparkles, iconBg: 'bg-sky-100 text-sky-600', path: '/sales-executive/leads/new' },
  { key: 'connectedLeads', label: 'Connected Leads', icon: Phone, iconBg: 'bg-emerald-100 text-emerald-600', path: '/sales-executive/leads/contacted' },
  { key: 'todayFollowups', label: "Today's Follow-ups", icon: CalendarClock, iconBg: 'bg-blue-100 text-blue-600', path: '/sales-executive/follow-ups' },
  { key: 'hotLeads', label: 'Hot Leads', icon: Flame, iconBg: 'bg-orange-100 text-orange-600', path: '/sales-executive/leads/hot' },
  { key: 'monthlyRevenue', label: 'Monthly Revenue', icon: IndianRupee, iconBg: 'bg-rose-100 text-rose-600', format: formatCurrency },
];

function TrendBadge({ trend }) {
  if (!trend) return <span className="text-[9px] text-content-muted">Live data</span>;
  const { change, period } = trend;
  const isUp = change > 0;
  const isDown = change < 0;
  const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;
  const colorClass = isUp
    ? 'text-emerald-600 dark:text-emerald-400'
    : isDown
      ? 'text-rose-600 dark:text-rose-400'
      : 'text-content-muted';

  return (
    <p className={`mt-1 flex items-center gap-1 text-[9px] font-medium ${colorClass}`}>
      <Icon className="w-3 h-3 shrink-0" />
      <span>{Math.abs(change)}% {period}</span>
    </p>
  );
}

export default function ExecutiveKpiCards({ kpis, trends }) {
  if (!kpis) return null;

  return (
    <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
      {cards.map(({ key, label, icon: Icon, iconBg, format, path }, i) => {
        const value = kpis[key];
        const Wrapper = path ? Link : 'div';

        return (
          <motion.div
            key={key}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="min-w-0"
          >
            <Wrapper
              {...(path ? { to: path } : {})}
              className="flex min-h-[82px] items-center gap-3 rounded-xl border border-subtle bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-900/80"
            >
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[9px] font-bold uppercase tracking-wide text-content-muted">{label}</p>
                <p className="mt-0.5 truncate text-xl font-bold leading-none text-content-primary">
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
