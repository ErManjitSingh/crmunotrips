import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Users,
  Sun,
  Flame,
  Snowflake,
  Briefcase,
  IndianRupee,
  Percent,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { withPeriodParams } from '../../lib/periodFilters';

function formatValue(value, { currency, suffix } = {}) {
  const n = Number(value || 0);
  if (currency) {
    if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
    if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
    if (n >= 1000) return `₹${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`;
    return `₹${n.toLocaleString('en-IN')}`;
  }
  if (suffix === '%') return `${n}%`;
  return n.toLocaleString('en-IN');
}

const KPI_ITEMS = [
  {
    key: 'totalLeads',
    label: 'Leads',
    icon: Users,
    path: '/leads',
    card: 'bg-gradient-to-br from-violet-600 to-indigo-700 border-violet-500/30 shadow-violet-500/20',
    iconWrap: 'bg-white/20 text-white',
    labelCls: 'text-violet-100',
    valueCls: 'text-white',
    upCls: 'text-emerald-200',
    downCls: 'text-rose-200',
    flatCls: 'text-violet-100/80',
  },
  {
    key: 'warm',
    label: 'Warm',
    icon: Sun,
    path: '/leads?listStatus=warm',
    card: 'bg-gradient-to-br from-amber-500 to-orange-600 border-amber-400/30 shadow-amber-500/20',
    iconWrap: 'bg-white/20 text-white',
    labelCls: 'text-amber-50',
    valueCls: 'text-white',
    upCls: 'text-emerald-100',
    downCls: 'text-rose-100',
    flatCls: 'text-amber-50/85',
  },
  {
    key: 'hot',
    label: 'Hot',
    icon: Flame,
    path: '/leads?listStatus=hot',
    card: 'bg-gradient-to-br from-rose-500 to-red-600 border-rose-400/30 shadow-rose-500/20',
    iconWrap: 'bg-white/20 text-white',
    labelCls: 'text-rose-50',
    valueCls: 'text-white',
    upCls: 'text-emerald-100',
    downCls: 'text-rose-100',
    flatCls: 'text-rose-50/85',
  },
  {
    key: 'cold',
    label: 'Cold',
    icon: Snowflake,
    path: '/leads?listStatus=cold',
    card: 'bg-gradient-to-br from-slate-500 to-slate-700 border-slate-400/30 shadow-slate-500/20',
    iconWrap: 'bg-white/20 text-white',
    labelCls: 'text-slate-50',
    valueCls: 'text-white',
    upCls: 'text-emerald-100',
    downCls: 'text-rose-100',
    flatCls: 'text-slate-50/85',
  },
  {
    key: 'bookings',
    label: 'Bookings',
    icon: Briefcase,
    path: '/leads/converted',
    fallbackKey: 'conversions',
    /** All-time — do not append period query params */
    ignorePeriod: true,
    card: 'bg-gradient-to-br from-sky-500 to-blue-600 border-sky-400/30 shadow-sky-500/20',
    iconWrap: 'bg-white/20 text-white',
    labelCls: 'text-sky-50',
    valueCls: 'text-white',
    upCls: 'text-emerald-100',
    downCls: 'text-rose-100',
    flatCls: 'text-sky-50/85',
    changeLabel: 'all time',
  },
  {
    key: 'revenue',
    label: 'Revenue',
    icon: IndianRupee,
    path: '/payments',
    currency: true,
    ignorePeriod: true,
    card: 'bg-gradient-to-br from-teal-500 to-cyan-700 border-teal-400/30 shadow-teal-500/20',
    iconWrap: 'bg-white/20 text-white',
    labelCls: 'text-teal-50',
    valueCls: 'text-white',
    upCls: 'text-emerald-100',
    downCls: 'text-rose-100',
    flatCls: 'text-teal-50/85',
    changeLabel: 'all time',
  },
  {
    key: 'conversionRate',
    label: 'Conv. Rate',
    short: 'Conv.',
    icon: Percent,
    path: '/reports',
    suffix: '%',
    ignorePeriod: true,
    card: 'bg-gradient-to-br from-fuchsia-500 to-pink-600 border-fuchsia-400/30 shadow-fuchsia-500/20',
    iconWrap: 'bg-white/20 text-white',
    labelCls: 'text-fuchsia-50',
    valueCls: 'text-white',
    upCls: 'text-emerald-100',
    downCls: 'text-rose-100',
    flatCls: 'text-fuchsia-50/85',
    changeLabel: 'all time',
  },
];

export default function DashboardHero({ stats, filters }) {
  const kpis = stats?.report?.kpis || {};

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7 lg:gap-2">
      {KPI_ITEMS.map((cfg, i) => {
        const meta =
          kpis[cfg.key] ||
          (cfg.fallbackKey ? kpis[cfg.fallbackKey] : null) || {
            value: 0,
            change: 0,
            changeType: 'neutral',
          };
        const display = formatValue(meta.value, cfg);
        const isUp = meta.changeType === 'up';
        const isDown = meta.changeType === 'down';
        const Icon = cfg.icon;
        const TrendIcon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;
        const changeAbs = Math.abs(Number(meta.change || 0));
        const href = cfg.ignorePeriod ? cfg.path : withPeriodParams(cfg.path, filters);

        return (
          <motion.div
            key={cfg.key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: i * 0.025 }}
            className="min-w-0"
            title={cfg.label}
          >
            <Link
              to={href}
              className={cn(
                'flex h-full min-h-[88px] cursor-pointer flex-col justify-between gap-2 rounded-2xl border px-2.5 py-2.5 shadow-md transition hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:min-h-[92px]',
                cfg.card
              )}
            >
              <div className="flex items-start justify-between gap-1.5">
                <p className={cn('truncate text-[10px] font-bold uppercase tracking-wide', cfg.labelCls)}>
                  <span className="xl:hidden">{cfg.short || cfg.label}</span>
                  <span className="hidden xl:inline">{cfg.label}</span>
                </p>
                <span
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg backdrop-blur-sm',
                    cfg.iconWrap
                  )}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
                </span>
              </div>

              <div className="min-w-0">
                <p
                  className={cn(
                    'truncate text-[22px] font-bold leading-none tracking-tight metric-tabular drop-shadow-sm',
                    cfg.valueCls
                  )}
                >
                  {display}
                </p>
                <p
                  className={cn(
                    'mt-1.5 flex min-w-0 items-center gap-1 text-[10px] font-semibold leading-none',
                    isUp && cfg.upCls,
                    isDown && cfg.downCls,
                    !isUp && !isDown && cfg.flatCls
                  )}
                >
                  <TrendIcon className="h-3 w-3 shrink-0" />
                  <span className="truncate">
                    {cfg.changeLabel
                      ? cfg.changeLabel
                      : `${changeAbs}% vs yday`}
                  </span>
                </p>
              </div>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}
