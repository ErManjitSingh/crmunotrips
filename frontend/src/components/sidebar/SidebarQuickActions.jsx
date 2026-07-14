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

function KeyHighlightsPanel({ highlights }) {
  if (!highlights) {
    return (
      <div className="space-y-2 px-1 py-1">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded-xl bg-white/[0.06]" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {HIGHLIGHT_ITEMS.map((item, i) => {
        const Icon = item.icon;
        return (
          <motion.div
            key={item.key}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
            className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.04] px-2.5 py-2"
          >
            <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', item.iconBg)}>
              <Icon className="h-3.5 w-3.5 text-white" strokeWidth={2.2} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[10px] text-slate-400">{item.label}</p>
              <p className="truncate text-[12px] font-semibold text-white">{item.getValue(highlights)}</p>
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
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-2 pb-3">
        <div
          className={cn(
            'rounded-2xl border border-white/[0.08] p-3',
            'bg-gradient-to-br from-violet-900/60 via-indigo-900/50 to-slate-900/60',
            'shadow-lg shadow-black/20'
          )}
        >
          <div className="mb-2 flex items-center justify-between gap-2 px-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {showHighlights ? 'Key Highlights' : 'Quick Actions'}
            </p>
            {showHighlights && highlights?.periodLabel ? (
              <span className="truncate text-[10px] text-slate-500">{highlights.periodLabel}</span>
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
