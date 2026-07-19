import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, CalendarClock, Trophy, Flame } from 'lucide-react';
import { useSidebarCounts } from '../../hooks/useSidebarCounts';

const CARDS = [
  {
    key: 'new',
    label: 'Today Lead',
    path: '/sales-executive/leads/new',
    icon: Sparkles,
    iconBg: 'bg-[#5D5FEF]',
  },
  {
    key: 'hot',
    label: 'Hot Leads',
    path: '/sales-executive/leads/hot',
    icon: Flame,
    iconBg: 'bg-orange-500',
  },
  {
    key: 'followupsDue',
    label: 'Follow-ups Due',
    path: '/sales-executive/follow-ups',
    icon: CalendarClock,
    iconBg: 'bg-sky-500',
  },
  {
    key: 'converted',
    label: 'Converted',
    path: '/sales-executive/leads/converted',
    icon: Trophy,
    iconBg: 'bg-emerald-500',
  },
];

function getCount(counts, key) {
  if (!counts) return 0;
  if (key === 'followupsDue') return counts.followups?.due ?? 0;
  return counts.leads?.[key] ?? 0;
}

export default function ExecutiveLeadKpiStrip() {
  const counts = useSidebarCounts();

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 w-full">
      {CARDS.map(({ key, label, path, icon: Icon, iconBg }, i) => {
        const value = getCount(counts, key);
        return (
          <motion.div
            key={key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
          >
            <Link
              to={path}
              className="block rounded-2xl border border-subtle bg-white dark:bg-slate-900 shadow-sm p-4 min-h-[108px] hover:shadow-md hover:border-[#5D5FEF]/25 transition-all"
            >
              <div className={`inline-flex w-10 h-10 items-center justify-center rounded-xl ${iconBg} text-white shadow-sm mb-3`}>
                <Icon className="w-5 h-5" strokeWidth={2} />
              </div>
              <p className="text-[11px] font-medium text-content-muted leading-tight">{label}</p>
              <p className="text-2xl font-bold text-content-primary tabular-nums mt-1 leading-none">
                {value}
              </p>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}
