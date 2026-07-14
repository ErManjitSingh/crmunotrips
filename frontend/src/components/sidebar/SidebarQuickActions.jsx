import { Link } from 'react-router-dom';
import { ChevronRight, Target, IndianRupee, UserRound, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSidebar } from '../../context/SidebarContext';
import { useDashboardQuery } from '../../features/dashboard/hooks/useDashboardQuery';
import { cn } from '../../lib/utils';

function formatCurrency(n) {
  if (n == null) return '₹0';
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  return `₹${Number(n).toLocaleString('en-IN')}`;
}

const HIGHLIGHT_ITEMS = [
  {
    key: 'source',
    label: 'Top Source',
    icon: Target,
    iconBg: 'bg-blue-500',
    getValue: (h) => `${h.highestLeadsSource?.name || '—'} (${h.highestLeadsSource?.pct || 0}%)`,
  },
  {
    key: 'exec',
    label: 'Best Exec',
    icon: UserRound,
    iconBg: 'bg-violet-500',
    getValue: (h) => h.bestPerformingExecutive?.name || '—',
  },
  {
    key: 'conv',
    label: 'Conv. Rate',
    icon: TrendingUp,
    iconBg: 'bg-emerald-500',
    getValue: (h) => `${h.conversionRate ?? 0}%`,
  },
  {
    key: 'rev',
    label: 'Revenue',
    icon: IndianRupee,
    iconBg: 'bg-teal-500',
    getValue: (h) => formatCurrency(h.revenueGenerated),
  },
];

function KeyHighlightsPanel({ highlights }) {
  if (!highlights) {
    return (
      <div className="grid grid-cols-2 gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-9 animate-pulse rounded-lg bg-white/[0.06]" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-1">
      {HIGHLIGHT_ITEMS.map((item, i) => {
        const Icon = item.icon;
        return (
          <motion.div
            key={item.key}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className="flex min-w-0 items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.04] px-1.5 py-1.5"
          >
            <div className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full', item.iconBg)}>
              <Icon className="h-2.5 w-2.5 text-white" strokeWidth={2.4} />
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-[9px] text-slate-500">{item.label}</p>
              <p className="truncate text-[10px] font-semibold text-white">{item.getValue(highlights)}</p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function ActionLinks({ actions, onNavigate }) {
  return (
    <div className="space-y-0.5">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Link
            key={action.path}
            to={action.path}
            onClick={onNavigate}
            className="group flex items-center gap-2.5 rounded-xl px-2 py-2 text-[13px] font-medium text-slate-300 transition-colors hover:bg-white/[0.08] hover:text-white"
          >
            <Icon className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-violet-400" strokeWidth={2} />
            <span className="flex-1 truncate">{action.label}</span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-500 opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>
        );
      })}
    </div>
  );
}

export default function SidebarQuickActions({ actions }) {
  const { collapsed, setMobileOpen } = useSidebar();
  const showHighlights = actions === undefined;
  const showCustomActions = Array.isArray(actions) && actions.length > 0;

  const { data: stats } = useDashboardQuery('/dashboard/stats', {}, { enabled: showHighlights && !collapsed });

  if (collapsed) return null;
  if (!showHighlights && !showCustomActions) return null;

  const highlights = stats?.report?.keyHighlights;

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-2 pb-2">
        <div
          className={cn(
            'rounded-xl border border-white/[0.08] p-2',
            'bg-gradient-to-br from-violet-900/60 via-indigo-900/50 to-slate-900/60',
            'shadow-md shadow-black/15'
          )}
        >
          <div className="mb-1.5 flex items-center justify-between gap-2 px-0.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {showHighlights ? 'Key Highlights' : 'Quick Actions'}
            </p>
            {showHighlights && highlights?.periodLabel ? (
              <span className="truncate text-[9px] text-slate-500">{highlights.periodLabel}</span>
            ) : null}
          </div>

          {showHighlights ? (
            <KeyHighlightsPanel highlights={highlights} />
          ) : (
            <ActionLinks actions={actions} onNavigate={() => setMobileOpen(false)} />
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
