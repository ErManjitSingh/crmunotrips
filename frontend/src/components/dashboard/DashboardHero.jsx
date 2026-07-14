import { motion } from 'framer-motion';
import {
  Users,
  Sparkles,
  Clock3,
  Heart,
  Handshake,
  UserX,
  CheckCircle2,
  IndianRupee,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { cn } from '../../lib/utils';

function formatCurrency(n) {
  if (n == null) return '₹0';
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${Number(n).toLocaleString('en-IN')}`;
}

function formatChange(change) {
  const abs = Math.abs(change || 0);
  return `${abs}%`;
}

const KPI_ITEMS = [
  { key: 'totalLeads', label: 'Total Leads', icon: Users, iconBg: 'bg-blue-500', ring: 'ring-blue-100 dark:ring-blue-500/20' },
  { key: 'freshLeads', label: 'Fresh Leads', icon: Sparkles, iconBg: 'bg-emerald-500', ring: 'ring-emerald-100 dark:ring-emerald-500/20' },
  { key: 'followUpPending', label: 'Follow Up Pending', icon: Clock3, iconBg: 'bg-amber-500', ring: 'ring-amber-100 dark:ring-amber-500/20' },
  { key: 'interested', label: 'Interested', icon: Heart, iconBg: 'bg-violet-500', ring: 'ring-violet-100 dark:ring-violet-500/20' },
  { key: 'negotiation', label: 'Negotiation', icon: Handshake, iconBg: 'bg-orange-500', ring: 'ring-orange-100 dark:ring-orange-500/20' },
  { key: 'lostLeads', label: 'Lost Leads', icon: UserX, iconBg: 'bg-red-500', ring: 'ring-red-100 dark:ring-red-500/20' },
  { key: 'conversions', label: 'Conversions', icon: CheckCircle2, iconBg: 'bg-emerald-600', ring: 'ring-emerald-100 dark:ring-emerald-500/20' },
  { key: 'revenue', label: 'Revenue Generated', icon: IndianRupee, iconBg: 'bg-blue-600', ring: 'ring-blue-100 dark:ring-blue-500/20', format: formatCurrency },
];

export default function DashboardHero({ stats }) {
  const kpis = stats?.report?.kpis || {};
  const compareLabel = stats?.report?.period?.compareLabel || 'prev period';

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
      {KPI_ITEMS.map((cfg, i) => {
        const meta = kpis[cfg.key] || { value: 0, change: 0, changeType: 'neutral' };
        const value = cfg.format ? cfg.format(meta.value) : (meta.value ?? 0).toLocaleString('en-IN');
        const isUp = meta.changeType === 'up';
        const isDown = meta.changeType === 'down';
        const Icon = cfg.icon;

        return (
          <motion.div
            key={cfg.key}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: i * 0.04 }}
            className={cn(
              'group relative flex flex-col items-center rounded-2xl border border-subtle bg-surface p-4 text-center shadow-sm',
              'transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md'
            )}
          >
            <div
              className={cn(
                'mb-3 flex h-11 w-11 items-center justify-center rounded-full shadow-sm ring-4',
                cfg.iconBg,
                cfg.ring
              )}
            >
              <Icon className="h-[18px] w-[18px] text-white" strokeWidth={2.2} />
            </div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-content-muted">
              {cfg.label}
            </p>
            <p className="text-xl font-bold tracking-tight text-content-primary metric-tabular leading-none sm:text-2xl">
              {value}
            </p>
            <div
              className={cn(
                'mt-2 inline-flex items-center gap-0.5 text-[11px] font-semibold',
                isUp && 'text-emerald-600',
                isDown && 'text-red-500',
                !isUp && !isDown && 'text-content-muted'
              )}
            >
              {isUp && <TrendingUp className="h-3 w-3" />}
              {isDown && <TrendingDown className="h-3 w-3" />}
              <span>
                {isUp ? '↑' : isDown ? '↓' : '→'} {formatChange(meta.change)}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] text-content-muted">vs {compareLabel}</p>
          </motion.div>
        );
      })}
    </div>
  );
}
