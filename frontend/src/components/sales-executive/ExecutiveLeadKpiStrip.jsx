import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, CalendarClock, Trophy, Flame } from 'lucide-react';
import { useSidebarCounts } from '../../hooks/useSidebarCounts';
import { cn } from '../../lib/utils';

const CARDS = [
  {
    key: 'new',
    label: 'Today Lead',
    path: '/sales-executive/leads/new',
    icon: Sparkles,
    card: 'bg-gradient-to-br from-[#5D5FEF] via-[#6D5FF0] to-[#7C3AED] shadow-[#5D5FEF]/35',
    iconWrap: 'bg-white/20 text-white ring-1 ring-white/30',
    labelClass: 'text-white/80',
    valueClass: 'text-white',
    blob: 'bg-white/15',
  },
  {
    key: 'hot',
    label: 'Hot Leads',
    path: '/sales-executive/leads/hot',
    icon: Flame,
    card: 'bg-gradient-to-br from-orange-500 via-orange-500 to-rose-500 shadow-orange-500/35',
    iconWrap: 'bg-white/20 text-white ring-1 ring-white/30',
    labelClass: 'text-white/85',
    valueClass: 'text-white',
    blob: 'bg-white/15',
  },
  {
    key: 'followupsDue',
    label: 'Follow-ups Due',
    path: '/sales-executive/follow-ups',
    icon: CalendarClock,
    card: 'bg-gradient-to-br from-sky-500 via-sky-500 to-blue-600 shadow-sky-500/35',
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
    card: 'bg-gradient-to-br from-emerald-500 via-emerald-500 to-teal-600 shadow-emerald-500/35',
    iconWrap: 'bg-white/20 text-white ring-1 ring-white/30',
    labelClass: 'text-white/85',
    valueClass: 'text-white',
    blob: 'bg-white/15',
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
                'relative block overflow-hidden rounded-2xl p-4 min-h-[112px] shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl',
                card
              )}
            >
              <div className={cn('pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full', blob)} />
              <div className={cn('pointer-events-none absolute -bottom-8 -left-4 h-20 w-20 rounded-full', blob)} />

              <div className="relative z-[1]">
                <div className={cn('inline-flex w-10 h-10 items-center justify-center rounded-xl mb-3', iconWrap)}>
                  <Icon className="w-5 h-5" strokeWidth={2.25} />
                </div>
                <p className={cn('text-[11px] font-semibold leading-tight', labelClass)}>{label}</p>
                <p className={cn('text-3xl font-bold tabular-nums mt-1 leading-none tracking-tight', valueClass)}>
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
