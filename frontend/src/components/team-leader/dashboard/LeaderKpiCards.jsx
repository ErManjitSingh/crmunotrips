import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, CalendarClock, Trophy, IndianRupee, TrendingUp, Target, Loader } from 'lucide-react';
import { formatCurrency } from '../leaderUtils';

const cards = [
  { key: 'teamLeads', label: 'Team Leads', icon: Users, gradient: 'from-amber-500 to-orange-600', path: '/team-leader/leads' },
  { key: 'workingProgress', label: 'Work in Progress', icon: Loader, gradient: 'from-orange-500 to-amber-600', path: '/team-leader/leads/working-progress' },
  { key: 'activeFollowups', label: 'Active Follow-ups', icon: CalendarClock, gradient: 'from-indigo-500 to-violet-600', path: '/team-leader/follow-ups' },
  { key: 'teamConversions', label: 'Team Conversions', icon: Trophy, gradient: 'from-emerald-500 to-teal-600', path: '/team-leader/leads?status=converted' },
  { key: 'teamRevenue', label: 'Team Revenue', icon: IndianRupee, gradient: 'from-brand-500 to-amber-600', format: formatCurrency, path: '/team-leader/reports' },
  { key: 'conversionRate', label: 'Conversion Rate', icon: TrendingUp, gradient: 'from-sky-500 to-cyan-600', suffix: '%', path: '/team-leader/reports' },
  { key: 'targetAchievement', label: 'Target Achievement', icon: Target, gradient: 'from-rose-500 to-pink-600', suffix: '%', path: '/team-leader/performance' },
];

export default function LeaderKpiCards({ kpis }) {
  if (!kpis) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-3">
      {cards.map(({ key, label, icon: Icon, gradient, format, suffix, path }, i) => (
        <motion.div
          key={key}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
        >
          <Link
            to={path}
            className="relative block overflow-hidden rounded-2xl border border-subtle bg-surface/80 backdrop-blur-xl p-4 min-h-[118px] cursor-pointer transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-[0.07]`} />
            <div className="relative">
              <div className={`inline-flex p-2 rounded-xl bg-gradient-to-br ${gradient} text-white shadow-md mb-3`}>
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-content-muted leading-tight">{label}</p>
              <p className="text-xl font-bold text-content-primary mt-1 tabular-nums">
                {format ? format(kpis[key]) : `${kpis[key] ?? 0}${suffix || ''}`}
              </p>
            </div>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
