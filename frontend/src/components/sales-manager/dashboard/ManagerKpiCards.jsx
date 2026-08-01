import { motion } from 'framer-motion';
import {
  Users,
  UserPlus,
  CalendarClock,
  Trophy,
  IndianRupee,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { formatCurrency } from '../managerUtils';
import { cn } from '../../../lib/utils';

const cards = [
  {
    key: 'totalTeamLeads',
    label: 'Total Team Leads',
    icon: Users,
    iconWrap: 'bg-sky-50 text-sky-600',
    trendKey: 'totalTeamLeadsTrend',
    trendFallback: '+12% vs last week',
    trendTone: 'up',
  },
  {
    key: 'newLeadsToday',
    label: "Today's New Leads",
    icon: UserPlus,
    iconWrap: 'bg-violet-50 text-violet-600',
    trendKey: 'newLeadsTrend',
    trendFallback: '+24% vs yesterday',
    trendTone: 'up',
  },
  {
    key: 'pendingFollowups',
    label: 'Pending Follow-ups',
    icon: CalendarClock,
    iconWrap: 'bg-amber-50 text-amber-600',
    trendKey: 'followupsHint',
    trendFallback: 'Needs attention',
    trendTone: 'warn',
  },
  {
    key: 'convertedLeads',
    label: 'Converted Leads',
    icon: Trophy,
    iconWrap: 'bg-emerald-50 text-emerald-600',
    trendKey: 'convertedHint',
    trendFallback: '0% conversion',
    trendTone: 'neutral',
  },
  {
    key: 'teamRevenue',
    label: 'Team Revenue',
    icon: IndianRupee,
    iconWrap: 'bg-indigo-50 text-indigo-600',
    format: formatCurrency,
    trendKey: 'revenueHint',
    trendFallback: 'Approved sales',
    trendTone: 'neutral',
  },
  {
    key: 'conversionRate',
    label: 'Conversion Rate',
    icon: TrendingUp,
    iconWrap: 'bg-rose-50 text-rose-600',
    suffix: '%',
    trendKey: 'conversionHint',
    trendFallback: 'Last 7 days',
    trendTone: 'neutral',
  },
];

function TrendLine({ tone, text }) {
  const Icon = tone === 'up' ? TrendingUp : tone === 'down' ? TrendingDown : null;
  return (
    <p
      className={cn(
        'mt-2 text-[11px] font-medium flex items-center gap-1',
        tone === 'up' && 'text-emerald-600',
        tone === 'down' && 'text-rose-600',
        tone === 'warn' && 'text-amber-600',
        tone === 'neutral' && 'text-slate-400'
      )}
    >
      {Icon ? <Icon className="w-3 h-3" /> : null}
      {text}
    </p>
  );
}

export default function ManagerKpiCards({ kpis }) {
  if (!kpis) return null;

  const convertedHint =
    kpis.totalTeamLeads > 0
      ? `${kpis.conversionRate || 0}% conversion`
      : '0% conversion';

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      {cards.map(({ key, label, icon: Icon, iconWrap, format, suffix, trendKey, trendFallback, trendTone }, i) => {
        let trendText = kpis[trendKey] || trendFallback;
        if (key === 'convertedLeads') trendText = convertedHint;
        if (key === 'pendingFollowups' && kpis.pendingFollowups > 0) {
          trendText = 'Needs attention';
        }

        return (
          <motion.div
            key={key}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm shadow-slate-200/60 min-h-[118px]"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 leading-tight">
                {label}
              </p>
              <div className={cn('inline-flex p-2 rounded-xl', iconWrap)}>
                <Icon className="w-4 h-4" strokeWidth={2.2} />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-2 tabular-nums tracking-tight">
              {format ? format(kpis[key]) : `${kpis[key] ?? 0}${suffix || ''}`}
            </p>
            <TrendLine tone={trendTone} text={trendText} />
          </motion.div>
        );
      })}
    </div>
  );
}
