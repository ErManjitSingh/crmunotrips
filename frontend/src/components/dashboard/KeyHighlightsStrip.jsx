import { motion } from 'framer-motion';
import { Target, IndianRupee, UserRound, TrendingUp } from 'lucide-react';
import { cn } from '../../lib/utils';

function formatCurrency(n) {
  if (n == null) return '₹0';
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  return `₹${Number(n).toLocaleString('en-IN')}`;
}

const CARDS = [
  {
    key: 'source',
    label: 'Highest Leads Source',
    icon: Target,
    iconBg: 'bg-blue-500',
    getValue: (h) => `${h.highestLeadsSource?.name || '—'} (${h.highestLeadsSource?.pct || 0}%)`,
  },
  {
    key: 'exec',
    label: 'Best Performing Executive',
    icon: UserRound,
    iconBg: 'bg-violet-500',
    getValue: (h) => h.bestPerformingExecutive?.name || '—',
  },
  {
    key: 'conv',
    label: 'Conversion Rate',
    icon: TrendingUp,
    iconBg: 'bg-emerald-500',
    getValue: (h) => `${h.conversionRate ?? 0}%`,
  },
  {
    key: 'rev',
    label: 'Revenue Generated',
    icon: IndianRupee,
    iconBg: 'bg-teal-500',
    getValue: (h) => formatCurrency(h.revenueGenerated),
  },
];

export default function KeyHighlightsStrip({ highlights }) {
  if (!highlights) return null;

  return (
    <div className="rounded-2xl border border-subtle bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950 p-4 shadow-lg sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Key Highlights</h2>
          <p className="text-xs text-slate-400">{highlights.periodLabel || 'Selected period'}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {CARDS.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={cn(
                'flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3.5 py-3',
                'backdrop-blur-sm transition-colors hover:bg-white/10'
              )}
            >
              <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', card.iconBg)}>
                <Icon className="h-4 w-4 text-white" strokeWidth={2.2} />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-slate-400">{card.label}</p>
                <p className="truncate text-sm font-semibold text-white">{card.getValue(highlights)}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
