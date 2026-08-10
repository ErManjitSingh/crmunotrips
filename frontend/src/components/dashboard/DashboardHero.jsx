import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Users,
  Phone,
  BadgeCheck,
  FileText,
  Briefcase,
  IndianRupee,
  Percent,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { cn } from '../../lib/utils';

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
    iconBg: 'bg-violet-100 text-violet-600',
    path: '/leads',
  },
  {
    key: 'connected',
    label: 'Connected',
    icon: Phone,
    iconBg: 'bg-emerald-100 text-emerald-600',
    path: '/leads?status=contacted',
  },
  {
    key: 'qualified',
    label: 'Qualified',
    icon: BadgeCheck,
    iconBg: 'bg-orange-100 text-orange-600',
    path: '/leads?status=qualified',
  },
  {
    key: 'quotations',
    label: 'Quotations',
    short: 'Quotes',
    icon: FileText,
    iconBg: 'bg-violet-100 text-violet-600',
    path: '/quotations',
  },
  {
    key: 'bookings',
    label: 'Bookings',
    icon: Briefcase,
    iconBg: 'bg-blue-100 text-blue-600',
    path: '/leads/converted',
    fallbackKey: 'conversions',
  },
  {
    key: 'revenue',
    label: 'Revenue',
    icon: IndianRupee,
    iconBg: 'bg-emerald-100 text-emerald-600',
    path: '/payments',
    currency: true,
  },
  {
    key: 'conversionRate',
    label: 'Conv. Rate',
    short: 'Conv.',
    icon: Percent,
    iconBg: 'bg-pink-100 text-pink-600',
    path: '/reports',
    suffix: '%',
  },
];

export default function DashboardHero({ stats }) {
  const kpis = stats?.report?.kpis || {};

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7 lg:gap-1.5">
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
              to={cfg.path}
              className="flex h-full min-h-0 flex-col gap-1 rounded-xl border border-slate-100 bg-white px-2 py-2 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 sm:flex-row sm:items-center sm:gap-1.5 sm:px-2 sm:py-2"
            >
              <div
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                  cfg.iconBg
                )}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={2.1} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                  <span className="xl:hidden">{cfg.short || cfg.label}</span>
                  <span className="hidden xl:inline">{cfg.label}</span>
                </p>
                <p className="truncate text-base font-bold leading-tight tracking-tight text-slate-900 metric-tabular sm:text-[17px]">
                  {display}
                </p>
                <p
                  className={cn(
                    'mt-0.5 flex min-w-0 items-center gap-0.5 text-[8px] font-semibold leading-none',
                    isUp && 'text-emerald-600',
                    isDown && 'text-red-500',
                    !isUp && !isDown && 'text-slate-400'
                  )}
                >
                  <TrendIcon className="h-2.5 w-2.5 shrink-0" />
                  <span className="truncate">{changeAbs}% vs yday</span>
                </p>
              </div>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}
