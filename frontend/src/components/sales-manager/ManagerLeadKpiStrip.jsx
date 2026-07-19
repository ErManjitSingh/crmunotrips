import { motion } from 'framer-motion';
import { Users, Sparkles, Flame, TrendingUp, AlertTriangle } from 'lucide-react';
import { useSidebarCounts } from '../../hooks/useSidebarCounts';

const CARDS = [
  { key: 'all', label: 'Total Leads', hint: 'All team leads', icon: Users, iconBg: 'bg-[#5D5FEF]' },
  { key: 'statusNew', label: 'New Leads', hint: 'Awaiting first contact', icon: Sparkles, iconBg: 'bg-sky-500' },
  { key: 'hot', label: 'Hot Leads', hint: 'High priority', icon: Flame, iconBg: 'bg-orange-500' },
  { key: 'inProgress', label: 'In Progress', hint: 'Active leads', icon: TrendingUp, iconBg: 'bg-violet-500' },
  { key: 'needsAttention', label: 'Urgent Leads', hint: 'Need attention', icon: AlertTriangle, iconBg: 'bg-rose-500', urgent: true },
];

function getCount(counts, key) {
  return counts?.leads?.[key] ?? 0;
}

export default function ManagerLeadKpiStrip() {
  const counts = useSidebarCounts();

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2.5 flex-1 min-w-0">
      {CARDS.map(({ key, label, hint, icon: Icon, iconBg, urgent }, i) => {
        const value = getCount(counts, key);
        return (
          <motion.div
            key={key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className={`rounded-xl border bg-white dark:bg-slate-900 shadow-sm p-3 min-h-[88px] flex flex-col ${
              urgent ? 'border-rose-500/25 ring-1 ring-rose-500/10' : 'border-subtle'
            }`}
          >
            <div className={`inline-flex w-8 h-8 items-center justify-center rounded-lg ${iconBg} text-white shadow-sm mb-2`}>
              <Icon className="w-4 h-4" strokeWidth={2} />
            </div>
            <p className="text-[10px] font-medium text-content-muted leading-tight">{label}</p>
            <p className={`text-xl font-bold tabular-nums mt-0.5 leading-none ${urgent ? 'text-rose-600 dark:text-rose-400' : 'text-content-primary'}`}>
              {value}
            </p>
            <p className={`text-[9px] mt-1 ${urgent ? 'text-rose-600/80 dark:text-rose-400/80 font-medium' : 'text-content-muted'}`}>
              {hint}
            </p>
          </motion.div>
        );
      })}
    </div>
  );
}
