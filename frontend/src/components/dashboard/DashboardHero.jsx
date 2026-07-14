import { motion } from 'framer-motion';
import {
  Users,
  Sparkles,
  Clock3,
  Heart,
  Handshake,
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
    card: 'from-blue-50 to-blue-100/40 border-blue-200/70 dark:from-blue-500/15 dark:to-blue-500/5 dark:border-blue-500/25',
    value: 'text-blue-700 dark:text-blue-300',
    glow: 'bg-blue-400/30',
  },
  {
    key: 'freshLeads',
    label: 'Fresh Leads',
    icon: Sparkles,
    iconBg: 'bg-emerald-500',
    card: 'from-emerald-50 to-emerald-100/40 border-emerald-200/70 dark:from-emerald-500/15 dark:to-emerald-500/5 dark:border-emerald-500/25',
    value: 'text-emerald-700 dark:text-emerald-300',
    glow: 'bg-emerald-400/30',
  },
  {
    key: 'followUpPending',
    label: 'Follow Up Pending',
    icon: Clock3,
    iconBg: 'bg-amber-500',
    card: 'from-amber-50 to-amber-100/40 border-amber-200/70 dark:from-amber-500/15 dark:to-amber-500/5 dark:border-amber-500/25',
    value: 'text-amber-700 dark:text-amber-300',
    glow: 'bg-amber-400/30',
  },
  {
    key: 'interested',
    label: 'Interested',
    icon: Heart,
    iconBg: 'bg-violet-500',
    card: 'from-violet-50 to-violet-100/40 border-violet-200/70 dark:from-violet-500/15 dark:to-violet-500/5 dark:border-violet-500/25',
    value: 'text-violet-700 dark:text-violet-300',
    glow: 'bg-violet-400/30',
  },
  {
    key: 'negotiation',
    label: 'Negotiation',
    icon: Handshake,
    iconBg: 'bg-orange-500',
    card: 'from-orange-50 to-orange-100/40 border-orange-200/70 dark:from-orange-500/15 dark:to-orange-500/5 dark:border-orange-500/25',
    value: 'text-orange-700 dark:text-orange-300',
    glow: 'bg-orange-400/30',
  },
  {
    key: 'lostLeads',
    label: 'Lost Leads',
    icon: UserX,
    iconBg: 'bg-red-500',
    card: 'from-red-50 to-red-100/40 border-red-200/70 dark:from-red-500/15 dark:to-red-500/5 dark:border-red-500/25',
    value: 'text-red-700 dark:text-red-300',
    glow: 'bg-red-400/30',
  },
  {
    key: 'conversions',
    label: 'Conversions',
    icon: CheckCircle2,
    iconBg: 'bg-teal-600',
    card: 'from-teal-50 to-teal-100/40 border-teal-200/70 dark:from-teal-500/15 dark:to-teal-500/5 dark:border-teal-500/25',
    value: 'text-teal-700 dark:text-teal-300',
    glow: 'bg-teal-400/30',
  },
];

function AnimatedIcon({ Icon, className }) {
  return (
    <motion.div
      className={cn('relative flex h-10 w-10 items-center justify-center rounded-full shadow-sm sm:h-11 sm:w-11', className)}
      animate={{ y: [0, -3, 0], rotate: [0, -4, 4, 0] }}
      transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
    >
      <motion.span
        className="absolute inset-0 rounded-full bg-white/25"
        animate={{ scale: [1, 1.25, 1], opacity: [0.35, 0, 0.35] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeOut' }}
      />
      <Icon className="relative h-4 w-4 text-white sm:h-[18px] sm:w-[18px]" strokeWidth={2.2} />
    </motion.div>
  );
}

export default function DashboardHero({ stats }) {
  const kpis = stats?.report?.kpis || {};
  const compareLabel = stats?.report?.period?.compareLabel || 'prev period';

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-3 md:grid-cols-3 xl:grid-cols-7">
      {KPI_ITEMS.map((cfg, i) => {
        const meta = kpis[cfg.key] || { value: 0, change: 0, changeType: 'neutral' };
        const value = (meta.value ?? 0).toLocaleString('en-IN');
        const isUp = meta.changeType === 'up';
        const isDown = meta.changeType === 'down';
        const Icon = cfg.icon;

        return (
          <motion.div
            key={cfg.key}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.4, delay: i * 0.05 }}
            whileHover={{ y: -4, scale: 1.02 }}
            className={cn(
              'group relative overflow-hidden rounded-2xl border bg-gradient-to-br p-3 shadow-sm sm:p-4',
              cfg.card
            )}
          >
            <motion.div
              className={cn('pointer-events-none absolute -right-4 -top-4 h-20 w-20 rounded-full blur-2xl', cfg.glow)}
              animate={{ opacity: [0.35, 0.7, 0.35], scale: [1, 1.15, 1] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut', delay: i * 0.15 }}
            />

            <div className="relative mb-2 flex items-center gap-2.5 sm:mb-3 sm:flex-col sm:items-center sm:gap-2 sm:text-center">
              <AnimatedIcon Icon={Icon} className={cfg.iconBg} />
              <p className="min-w-0 text-[10px] font-semibold uppercase leading-tight tracking-wider text-content-muted">
                {cfg.label}
              </p>
            </div>

            <p className={cn('relative text-lg font-bold tracking-tight metric-tabular leading-none sm:text-center sm:text-xl lg:text-2xl', cfg.value)}>
              {value}
            </p>

            <div
              className={cn(
                'relative mt-1.5 inline-flex items-center gap-0.5 text-[10px] font-semibold sm:mt-2 sm:w-full sm:justify-center sm:text-[11px]',
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
            <p className="relative mt-0.5 truncate text-[9px] text-content-muted sm:text-center sm:text-[10px]">
              vs {compareLabel}
            </p>
          </motion.div>
        );
      })}
    </div>
  );
}
