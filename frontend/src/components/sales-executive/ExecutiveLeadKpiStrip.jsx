import { motion } from 'framer-motion';
import { Users, Sparkles, CalendarClock, Trophy, AlertTriangle } from 'lucide-react';
import { useSidebarCounts } from '../../hooks/useSidebarCounts';

const CARDS = [
  { key: 'all', label: 'Total Leads', icon: Users, iconBg: 'bg-[#5D5FEF]' },
  { key: 'new', label: 'Today Lead', icon: Sparkles, iconBg: 'bg-sky-400' },
  { key: 'followUp', label: 'Follow-ups', icon: CalendarClock, iconBg: 'bg-orange-400' },
  { key: 'converted', label: 'Converted', icon: Trophy, iconBg: 'bg-emerald-500' },
  { key: 'urgent', label: 'Urgent', icon: AlertTriangle, iconBg: 'bg-rose-400' },
];

function getCount(counts, key) {
  if (!counts?.leads) return 0;
  return counts.leads[key] ?? 0;
}

export default function ExecutiveLeadKpiStrip() {
  const counts = useSidebarCounts();

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 flex-1 min-w-0">
      {CARDS.map(({ key, label, icon: Icon, iconBg }, i) => {
        const value = getCount(counts, key);
        return (
          <motion.div
            key={key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="rounded-2xl border border-subtle bg-white dark:bg-slate-900 shadow-sm p-4 min-h-[108px] flex flex-col"
          >
            <div className={`inline-flex w-9 h-9 items-center justify-center rounded-xl ${iconBg} text-white shadow-sm mb-3`}>
              <Icon className="w-[18px] h-[18px]" strokeWidth={2} />
            </div>
            <p className="text-[11px] font-medium text-content-muted leading-tight">{label}</p>
            <p className="text-2xl font-bold text-content-primary tabular-nums mt-0.5 leading-none">
              {value}
            </p>
          </motion.div>
        );
      })}
    </div>
  );
}
