import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, Sparkles, Phone, Trophy, Loader } from 'lucide-react';
import { useSidebarCounts } from '../../hooks/useSidebarCounts';
import { cn } from '../../lib/utils';

const CARDS = [
  {
    key: 'all',
    label: 'Total Leads',
    path: '/sales-executive/leads/all',
    icon: Users,
    card: 'bg-gradient-to-br from-slate-700 via-slate-800 to-violet-900 shadow-slate-700/35',
    iconWrap: 'bg-white/20 text-white ring-1 ring-white/30',
    labelClass: 'text-white/80',
    valueClass: 'text-white',
    blob: 'bg-white/15',
  },
  {
    key: 'new',
    label: 'Fresh / Today',
    path: '/sales-executive/leads/new',
    icon: Sparkles,
    card: 'bg-gradient-to-br from-[#5D5FEF] via-[#6D5FF0] to-[#7C3AED] shadow-[#5D5FEF]/35',
    iconWrap: 'bg-white/20 text-white ring-1 ring-white/30',
    labelClass: 'text-white/80',
    valueClass: 'text-white',
    blob: 'bg-white/15',
  },
  {
    key: 'contacted',
    label: 'Connected',
    path: '/sales-executive/leads/contacted',
    icon: Phone,
    card: 'bg-gradient-to-br from-emerald-500 via-emerald-500 to-teal-600 shadow-emerald-500/35',
    iconWrap: 'bg-white/20 text-white ring-1 ring-white/30',
    labelClass: 'text-white/85',
    valueClass: 'text-white',
    blob: 'bg-white/15',
  },
  {
    key: 'workingProgress',
    label: 'Work in Progress',
    path: '/sales-executive/leads/working-progress',
    icon: Loader,
    card: 'bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-600 shadow-orange-500/35',
    iconWrap: 'bg-white/20 text-white ring-1 ring-white/30',
    labelClass: 'text-white/85',
    valueClass: 'text-white',
    blob: 'bg-white/15',
  },
  {
    key: 'converted',
    label: 'Converted',
    path: '/sales-executive/leads/converted',
    icon: Trophy,
    card: 'bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 shadow-orange-500/35',
    iconWrap: 'bg-white/20 text-white ring-1 ring-white/30',
    labelClass: 'text-white/85',
    valueClass: 'text-white',
    blob: 'bg-white/15',
  },
];

function getCount(counts, key) {
  if (!counts) return 0;
  return counts.leads?.[key] ?? 0;
}

export default function ExecutiveLeadKpiStrip() {
  const counts = useSidebarCounts();

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 w-full">
      {CARDS.map(({ key, label, path, icon: Icon, card, iconWrap, labelClass, valueClass, blob }, i) => {
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
              className={cn(
                'relative block cursor-pointer overflow-hidden rounded-xl p-3 min-h-[84px] shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg',
                card
              )}
            >
              <div className={cn('pointer-events-none absolute -right-5 -top-6 h-16 w-16 rounded-full', blob)} />
              <div className={cn('pointer-events-none absolute -bottom-6 -left-3 h-14 w-14 rounded-full', blob)} />

              <div className="relative z-[1]">
                <div className={cn('inline-flex w-8 h-8 items-center justify-center rounded-lg mb-2', iconWrap)}>
                  <Icon className="w-4 h-4" strokeWidth={2.25} />
                </div>
                <p className={cn('text-[10px] font-semibold leading-tight', labelClass)}>{label}</p>
                <p className={cn('text-2xl font-bold tabular-nums mt-0.5 leading-none tracking-tight', valueClass)}>
                  {value}
                </p>
              </div>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}
