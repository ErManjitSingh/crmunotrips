import { motion } from 'framer-motion';
import { CalendarDays, Flame, Snowflake, Trophy } from 'lucide-react';
import { cn } from '../../lib/utils';

const CARDS = [
  {
    key: 'total',
    label: 'Total Follow-ups',
    hint: 'All scheduled',
    icon: CalendarDays,
    card: 'bg-gradient-to-br from-violet-50 via-white to-violet-50/40 dark:from-violet-950/40 dark:via-slate-900 dark:to-violet-950/20 border-violet-200/70 dark:border-violet-800/40',
    iconWrap: 'bg-violet-500 text-white shadow-lg shadow-violet-500/30',
    valueClass: 'text-violet-700 dark:text-violet-300',
    hintClass: 'text-violet-500/80',
  },
  {
    key: 'warm',
    label: 'Warm Follow-ups',
    hint: 'High priority',
    icon: Flame,
    card: 'bg-gradient-to-br from-orange-50 via-white to-amber-50/50 dark:from-orange-950/30 dark:via-slate-900 dark:to-amber-950/20 border-orange-200/70 dark:border-orange-800/40',
    iconWrap: 'bg-orange-500 text-white shadow-lg shadow-orange-500/30',
    valueClass: 'text-orange-700 dark:text-orange-300',
    hintClass: 'text-orange-500/80',
  },
  {
    key: 'cold',
    label: 'Cold Follow-ups',
    hint: 'Low priority',
    icon: Snowflake,
    card: 'bg-gradient-to-br from-sky-50 via-white to-cyan-50/50 dark:from-sky-950/30 dark:via-slate-900 dark:to-cyan-950/20 border-sky-200/70 dark:border-sky-800/40',
    iconWrap: 'bg-sky-500 text-white shadow-lg shadow-sky-500/30',
    valueClass: 'text-sky-700 dark:text-sky-300',
    hintClass: 'text-sky-500/80',
  },
  {
    key: 'converted',
    label: 'Converted',
    hint: 'This month',
    icon: Trophy,
    card: 'bg-gradient-to-br from-emerald-50 via-white to-teal-50/50 dark:from-emerald-950/30 dark:via-slate-900 dark:to-teal-950/20 border-emerald-200/70 dark:border-emerald-800/40',
    iconWrap: 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30',
    valueClass: 'text-emerald-700 dark:text-emerald-300',
    hintClass: 'text-emerald-500/80',
  },
];

export default function ExecutiveFollowUpKpiStrip({ counts = {}, onSelect, activeKey }) {
  return (
    <div className="relative grid grid-cols-2 xl:grid-cols-5 gap-3">
      {CARDS.map(({ key, label, hint, icon: Icon, card, iconWrap, valueClass, hintClass }, i) => {
        const value = counts[key] ?? 0;
        const active = activeKey === key;
        return (
          <motion.button
            key={key}
            type="button"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            onClick={() => onSelect?.(key)}
            className={cn(
              'relative overflow-hidden rounded-2xl border p-4 text-left min-h-[118px] shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md',
              card,
              active && 'ring-2 ring-[#5D5FEF]/40 ring-offset-2 ring-offset-[var(--color-bg-app)]'
            )}
          >
            <div className={cn('inline-flex w-10 h-10 items-center justify-center rounded-xl mb-3', iconWrap)}>
              <Icon className="w-5 h-5" strokeWidth={2.25} />
            </div>
            <p className="text-[11px] font-semibold text-content-secondary leading-tight">{label}</p>
            <p className={cn('text-3xl font-bold tabular-nums mt-1 leading-none tracking-tight', valueClass)}>
              {value}
            </p>
            <p className={cn('text-[10px] font-medium mt-1.5', hintClass)}>{hint}</p>
          </motion.button>
        );
      })}

      <div className="hidden xl:flex relative overflow-hidden rounded-2xl border border-violet-100 dark:border-violet-900/40 bg-gradient-to-br from-violet-50 via-white to-indigo-50 dark:from-violet-950/40 dark:via-slate-900 dark:to-indigo-950/30 items-end justify-center min-h-[118px] shadow-sm">
        <div className="absolute inset-0 opacity-60 pointer-events-none bg-[radial-gradient(circle_at_70%_30%,rgba(93,95,239,0.2),transparent_55%)]" />
        <div className="relative pb-3 px-3 text-center">
          <div className="mx-auto mb-2 w-14 h-14 rounded-2xl bg-white shadow-md border border-violet-100 flex items-center justify-center">
            <CalendarDays className="w-7 h-7 text-[#5D5FEF]" />
          </div>
          <p className="text-[11px] font-semibold text-violet-700 dark:text-violet-300">Stay on schedule</p>
          <p className="text-[10px] text-content-muted mt-0.5">Never miss a callback</p>
        </div>
      </div>
    </div>
  );
}
