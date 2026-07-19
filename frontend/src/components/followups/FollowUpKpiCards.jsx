import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { KPI_CONFIG } from './constants';

const cardThemes = {
  today: {
    gradient: 'from-sky-500/20 via-blue-500/10 to-indigo-500/5 dark:from-sky-500/25 dark:via-blue-600/15',
    border: 'border-sky-400/40 hover:border-sky-400/70',
    activeRing: 'ring-2 ring-sky-500/50 ring-offset-2 ring-offset-[var(--color-bg-app)]',
    icon: 'bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/30',
    value: 'text-sky-700 dark:text-sky-300',
    label: 'text-sky-600/80 dark:text-sky-400/90',
    glow: 'bg-sky-400/20',
  },
  missed: {
    gradient: 'from-red-500/20 via-rose-500/10 to-orange-500/5 dark:from-red-500/25 dark:via-rose-600/15',
    border: 'border-red-400/40 hover:border-red-400/70',
    activeRing: 'ring-2 ring-red-500/50 ring-offset-2 ring-offset-[var(--color-bg-app)]',
    icon: 'bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-lg shadow-red-500/30',
    value: 'text-red-700 dark:text-red-300',
    label: 'text-red-600/80 dark:text-red-400/90',
    glow: 'bg-red-400/20',
  },
  upcoming: {
    gradient: 'from-violet-500/20 via-purple-500/10 to-fuchsia-500/5 dark:from-violet-500/25 dark:via-purple-600/15',
    border: 'border-violet-400/40 hover:border-violet-400/70',
    activeRing: 'ring-2 ring-violet-500/50 ring-offset-2 ring-offset-[var(--color-bg-app)]',
    icon: 'bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/30',
    value: 'text-violet-700 dark:text-violet-300',
    label: 'text-violet-600/80 dark:text-violet-400/90',
    glow: 'bg-violet-400/20',
  },
  completed: {
    gradient: 'from-emerald-500/20 via-green-500/10 to-teal-500/5 dark:from-emerald-500/25 dark:via-green-600/15',
    border: 'border-emerald-400/40 hover:border-emerald-400/70',
    activeRing: 'ring-2 ring-emerald-500/50 ring-offset-2 ring-offset-[var(--color-bg-app)]',
    icon: 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30',
    value: 'text-emerald-700 dark:text-emerald-300',
    label: 'text-emerald-600/80 dark:text-emerald-400/90',
    glow: 'bg-emerald-400/20',
  },
  conversion: {
    gradient: 'from-amber-500/20 via-orange-500/10 to-yellow-500/5 dark:from-amber-500/25 dark:via-orange-600/15',
    border: 'border-amber-400/40 hover:border-amber-400/70',
    activeRing: 'ring-2 ring-amber-500/50 ring-offset-2 ring-offset-[var(--color-bg-app)]',
    icon: 'bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30',
    value: 'text-amber-700 dark:text-amber-300',
    label: 'text-amber-600/80 dark:text-amber-400/90',
    glow: 'bg-amber-400/20',
  },
};

export default function FollowUpKpiCards({ kpis, onFilter, activeFilter }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 mb-5">
      {KPI_CONFIG.map((cfg, i) => {
        const Icon = cfg.icon;
        const value = kpis[cfg.key];
        const theme = cardThemes[cfg.key] || cardThemes.today;
        const isActive = activeFilter === cfg.key;

        return (
          <motion.button
            key={cfg.key}
            type="button"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -2, scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => onFilter?.(cfg.key)}
            className={cn(
              'relative overflow-hidden rounded-xl border p-3 text-left transition-all duration-300 min-h-[88px]',
              'bg-gradient-to-br backdrop-blur-sm shadow-sm hover:shadow-md',
              theme.gradient,
              theme.border,
              isActive && theme.activeRing
            )}
          >
            <div className={cn('absolute -right-4 -top-4 w-16 h-16 rounded-full blur-2xl pointer-events-none', theme.glow)} />

            <div className="relative flex items-start justify-between mb-2">
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', theme.icon)}>
                <Icon className="w-4 h-4" strokeWidth={2.25} />
              </div>
              {isActive && (
                <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/60 dark:bg-black/30 text-content-primary">
                  Active
                </span>
              )}
            </div>

            <p className={cn('relative text-2xl font-black metric-tabular tracking-tight leading-none', theme.value)}>
              {value}{cfg.suffix || ''}
            </p>
            <p className={cn('relative text-[10px] font-semibold mt-1.5 leading-snug', theme.label)}>{cfg.label}</p>
          </motion.button>
        );
      })}
    </div>
  );
}
