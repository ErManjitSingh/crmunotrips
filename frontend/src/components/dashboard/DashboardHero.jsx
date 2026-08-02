import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Users,
  Sparkles,
  Clock3,
  Heart,
  Phone,
  UserX,
  CheckCircle2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { cn } from '../../lib/utils';

function formatChange(change) {
  const abs = Math.abs(change || 0);
  return `${abs}%`;
}

const KPI_ITEMS = [
  {
    key: 'totalLeads',
    label: 'Total Leads',
    icon: Users,
    iconBg: 'bg-blue-500',
    card: 'border-blue-100 bg-blue-50/70',
    value: 'text-blue-700',
    path: '/leads',
  },
  {
    key: 'freshLeads',
    label: 'Fresh Leads',
    icon: Sparkles,
    iconBg: 'bg-emerald-500',
    card: 'border-emerald-100 bg-emerald-50/70',
    value: 'text-emerald-700',
    path: '/leads/new-leads',
  },
  {
    key: 'followUpPending',
    label: 'Follow Up',
    icon: Clock3,
    iconBg: 'bg-amber-500',
    card: 'border-amber-100 bg-amber-50/70',
    value: 'text-amber-700',
    path: '/followups',
  },
  {
    key: 'interested',
    label: 'Interested',
    icon: Heart,
    iconBg: 'bg-violet-500',
    card: 'border-violet-100 bg-violet-50/70',
    value: 'text-violet-700',
    path: '/leads?status=working_progress',
  },
  {
    key: 'connected',
    label: 'Connected Leads',
    icon: Phone,
    iconBg: 'bg-emerald-600',
    card: 'border-emerald-100 bg-emerald-50/70',
    value: 'text-emerald-700',
    path: '/leads?status=contacted',
  },
  {
    key: 'lostLeads',
    label: 'Lost Leads',
    icon: UserX,
    iconBg: 'bg-red-500',
    card: 'border-red-100 bg-red-50/70',
    value: 'text-red-700',
    path: '/leads/lost',
  },
  {
    key: 'conversions',
    label: 'Conversions',
    icon: CheckCircle2,
    iconBg: 'bg-teal-600',
    card: 'border-teal-100 bg-teal-50/70',
    value: 'text-teal-700',
    path: '/leads/converted',
  },
];

export default function DashboardHero({ stats }) {
  const kpis = stats?.report?.kpis || {};
  const compareLabel = stats?.report?.period?.compareLabel || 'prev period';

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-7">
      {KPI_ITEMS.map((cfg, i) => {
        const meta = kpis[cfg.key] || { value: 0, change: 0, changeType: 'neutral' };
        const value = (meta.value ?? 0).toLocaleString('en-IN');
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
                'flex items-center gap-2.5 rounded-xl border px-2.5 py-2 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
                cfg.card
              )}
            >
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-sm',
                  cfg.iconBg
                )}
              >
                <Icon className="h-3.5 w-3.5 text-white" strokeWidth={2.25} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    {cfg.label}
                  </p>
                  <span
                    className={cn(
                      'inline-flex shrink-0 items-center gap-0.5 text-[9px] font-bold',
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
                <p className={cn('mt-0.5 text-base font-bold leading-none metric-tabular tracking-tight', cfg.value)}>
                  {value}
                </p>
                <p className="mt-0.5 truncate text-[9px] text-slate-400">vs {compareLabel}</p>
              </div>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}
