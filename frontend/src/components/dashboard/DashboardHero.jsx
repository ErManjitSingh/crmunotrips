import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Users,
  Phone,
  BadgeCheck,
  FileText,
  Briefcase,
  IndianRupee,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { cn } from '../../lib/utils';

function formatChange(change) {
  const abs = Math.abs(change || 0);
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
    iconBg: 'bg-violet-500',
    card: 'border-violet-100 bg-white',
    value: 'text-slate-900',
    path: '/leads',
  },
  {
    key: 'connected',
    label: 'Connected',
    icon: Phone,
    iconBg: 'bg-indigo-500',
    card: 'border-indigo-100 bg-white',
    value: 'text-slate-900',
    path: '/leads?status=contacted',
  },
  {
    key: 'qualified',
    label: 'Qualified',
    icon: BadgeCheck,
    iconBg: 'bg-emerald-500',
    card: 'border-emerald-100 bg-white',
    value: 'text-slate-900',
    path: '/leads?status=qualified',
  },
  {
    key: 'quotations',
    label: 'Quotations',
    icon: FileText,
    iconBg: 'bg-blue-500',
    card: 'border-blue-100 bg-white',
    value: 'text-slate-900',
    path: '/quotations',
  },
  {
    key: 'bookings',
    label: 'Bookings',
    icon: Briefcase,
    iconBg: 'bg-amber-500',
    card: 'border-amber-100 bg-white',
    value: 'text-slate-900',
    path: '/leads/converted',
    fallbackKey: 'conversions',
  },
  {
    key: 'revenue',
    label: 'Revenue',
    icon: IndianRupee,
    iconBg: 'bg-pink-500',
    card: 'border-pink-100 bg-white',
    value: 'text-slate-900',
    path: '/payments',
    currency: true,
  },
  {
    key: 'conversionRate',
    label: 'Conversion Rate',
    icon: TrendingUp,
    iconBg: 'bg-teal-500',
    card: 'border-teal-100 bg-white',
    value: 'text-slate-900',
    path: '/reports',
    suffix: '%',
  },
];

export default function DashboardHero({ stats }) {
  const kpis = stats?.report?.kpis || {};
  const compareLabel = stats?.report?.period?.compareLabel || 'Yesterday';

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-7">
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
            transition={{ duration: 0.25, delay: i * 0.03 }}
            className="min-w-0"
          >
            <Link
              to={cfg.path}
              className={cn(
                'flex flex-col gap-2 rounded-xl border px-3 py-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400',
                cfg.card
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-sm',
                    cfg.iconBg
                  )}
                >
                  <Icon className="h-3.5 w-3.5 text-white" strokeWidth={2.25} />
                </div>
                <span
                  className={cn(
                    'inline-flex shrink-0 items-center gap-0.5 text-[10px] font-bold',
                    isUp && 'text-emerald-600',
                    isDown && 'text-red-500',
                    !isUp && !isDown && 'text-slate-400'
                  )}
                >
                  {isUp && <TrendingUp className="h-2.5 w-2.5" />}
                  {isDown && <TrendingDown className="h-2.5 w-2.5" />}
                  {formatChange(meta.change)}
                </span>
              </div>
              <div className="min-w-0">
                <p className="truncate text-[11px] font-medium text-slate-500">{cfg.label}</p>
                <p
                  className={cn(
                    'mt-0.5 text-xl font-bold leading-none metric-tabular tracking-tight',
                    cfg.value
                  )}
                >
                  {display}
                </p>
                <p className="mt-1 truncate text-[9px] text-slate-400">vs {compareLabel}</p>
              </div>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}
