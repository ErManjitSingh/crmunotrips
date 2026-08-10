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
} from 'lucide-react';
import { cn } from '../../lib/utils';

function formatChange(change, { points = false } = {}) {
  const abs = Math.abs(change || 0);
  if (points) return `${abs}%`;
  return `${abs}%`;
}

function formatValue(value, { currency, suffix } = {}) {
  const n = Number(value || 0);
  if (currency) {
    if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
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
    label: 'Conversion Rate',
    icon: Percent,
    iconBg: 'bg-pink-100 text-pink-600',
    path: '/reports',
    suffix: '%',
  },
];

export default function DashboardHero({ stats }) {
  const kpis = stats?.report?.kpis || {};

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-7">
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

        return (
          <motion.div
            key={cfg.key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: i * 0.03 }}
            className="min-w-0"
          >
            <Link
              to={cfg.path}
              className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-3.5 py-3.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
            >
              <div
                className={cn(
                  'flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
                  cfg.iconBg
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={2.1} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-medium text-slate-500">{cfg.label}</p>
                <p className="mt-0.5 text-[22px] font-bold leading-none tracking-tight text-slate-900 metric-tabular">
                  {display}
                </p>
                <p
                  className={cn(
                    'mt-1.5 inline-flex items-center gap-0.5 text-[10px] font-semibold',
                    isUp && 'text-emerald-600',
                    isDown && 'text-red-500',
                    !isUp && !isDown && 'text-slate-400'
                  )}
                >
                  <span className="font-medium text-slate-400">vs Yesterday</span>
                  {isUp && <TrendingUp className="ml-1 h-3 w-3" />}
                  {isDown && <TrendingDown className="ml-1 h-3 w-3" />}
                  <span>{formatChange(meta.change)}</span>
                </p>
              </div>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}
