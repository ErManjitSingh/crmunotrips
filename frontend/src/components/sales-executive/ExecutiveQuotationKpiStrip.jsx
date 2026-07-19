import { motion } from 'framer-motion';
import { FileText, Send, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

const CARDS = [
  {
    key: 'total',
    label: 'Total Quotations',
    hint: 'All time',
    icon: FileText,
    card: 'bg-gradient-to-br from-violet-50 via-white to-violet-50/40 dark:from-violet-950/40 dark:via-slate-900 dark:to-violet-950/20 border-violet-200/70 dark:border-violet-800/40',
    iconWrap: 'bg-violet-500 text-white shadow-md shadow-violet-500/25',
    valueClass: 'text-violet-700 dark:text-violet-300',
    hintClass: 'text-violet-500/80',
  },
  {
    key: 'sent',
    label: 'Sent',
    hint: 'Waiting for response',
    icon: Send,
    card: 'bg-gradient-to-br from-sky-50 via-white to-cyan-50/50 dark:from-sky-950/30 dark:via-slate-900 dark:to-cyan-950/20 border-sky-200/70 dark:border-sky-800/40',
    iconWrap: 'bg-sky-500 text-white shadow-md shadow-sky-500/25',
    valueClass: 'text-sky-700 dark:text-sky-300',
    hintClass: 'text-sky-500/80',
  },
  {
    key: 'approved',
    label: 'Approved',
    hint: 'Ready to send',
    icon: CheckCircle2,
    card: 'bg-gradient-to-br from-emerald-50 via-white to-teal-50/50 dark:from-emerald-950/30 dark:via-slate-900 dark:to-teal-950/20 border-emerald-200/70 dark:border-emerald-800/40',
    iconWrap: 'bg-emerald-500 text-white shadow-md shadow-emerald-500/25',
    valueClass: 'text-emerald-700 dark:text-emerald-300',
    hintClass: 'text-emerald-500/80',
  },
  {
    key: 'pending_approval',
    label: 'Pending Approval',
    hint: 'With team leader',
    icon: Clock,
    card: 'bg-gradient-to-br from-orange-50 via-white to-amber-50/50 dark:from-orange-950/30 dark:via-slate-900 dark:to-amber-950/20 border-orange-200/70 dark:border-orange-800/40',
    iconWrap: 'bg-orange-500 text-white shadow-md shadow-orange-500/25',
    valueClass: 'text-orange-700 dark:text-orange-300',
    hintClass: 'text-orange-500/80',
  },
  {
    key: 'rejected',
    label: 'Rejected',
    hint: 'This month',
    icon: XCircle,
    card: 'bg-gradient-to-br from-rose-50 via-white to-red-50/50 dark:from-rose-950/30 dark:via-slate-900 dark:to-red-950/20 border-rose-200/70 dark:border-rose-800/40',
    iconWrap: 'bg-rose-500 text-white shadow-md shadow-rose-500/25',
    valueClass: 'text-rose-700 dark:text-rose-300',
    hintClass: 'text-rose-500/80',
  },
];

export default function ExecutiveQuotationKpiStrip({ counts = {}, onSelect, activeKey }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2.5">
      {CARDS.map(({ key, label, hint, icon: Icon, card, iconWrap, valueClass, hintClass }, i) => {
        const value = counts[key] ?? 0;
        const active = activeKey === key || (key === 'total' && (!activeKey || activeKey === 'all'));
        return (
          <motion.button
            key={key}
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            onClick={() => onSelect?.(key === 'total' ? 'all' : key)}
            className={cn(
              'relative overflow-hidden rounded-xl border p-3 text-left min-h-[88px] shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md',
              card,
              active && 'ring-2 ring-[#5D5FEF]/35 ring-offset-2 ring-offset-[var(--color-bg-app)]'
            )}
          >
            <div className={cn('inline-flex w-8 h-8 items-center justify-center rounded-lg mb-2', iconWrap)}>
              <Icon className="w-4 h-4" strokeWidth={2.25} />
            </div>
            <p className="text-[10px] font-semibold text-content-secondary leading-tight">{label}</p>
            <p className={cn('text-2xl font-bold tabular-nums mt-0.5 leading-none tracking-tight', valueClass)}>
              {value}
            </p>
            <p className={cn('text-[10px] font-medium mt-1', hintClass)}>{hint}</p>
          </motion.button>
        );
      })}
    </div>
  );
}
