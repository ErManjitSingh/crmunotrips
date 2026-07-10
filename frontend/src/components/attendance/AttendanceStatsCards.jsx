import { motion } from 'framer-motion';
import { UserCheck, UserX, Clock, Building2, Wifi, Users, CalendarRange } from 'lucide-react';

const singleDayCards = [
  { key: 'presentToday', label: 'Present', icon: UserCheck, gradient: 'from-emerald-500 to-teal-600' },
  { key: 'absentToday', label: 'Absent', icon: UserX, gradient: 'from-rose-500 to-pink-600' },
  { key: 'lateToday', label: 'Late', icon: Clock, gradient: 'from-amber-500 to-orange-600' },
  { key: 'officeCount', label: 'Office', icon: Building2, gradient: 'from-blue-500 to-indigo-600' },
  { key: 'onlineCount', label: 'Online Now', icon: Wifi, gradient: 'from-cyan-500 to-sky-600' },
];

const rangeCards = [
  { key: 'totalCheckIns', label: 'Check-ins', icon: CalendarRange, gradient: 'from-brand-600 to-indigo-600' },
  { key: 'uniqueUsers', label: 'Team Members', icon: Users, gradient: 'from-sky-500 to-cyan-600' },
  { key: 'presentToday', label: 'On Time', icon: UserCheck, gradient: 'from-emerald-500 to-teal-600' },
  { key: 'lateToday', label: 'Late', icon: Clock, gradient: 'from-amber-500 to-orange-600' },
  { key: 'officeCount', label: 'Office', icon: Building2, gradient: 'from-blue-500 to-indigo-600' },
];

export default function AttendanceStatsCards({ summary, isRange = false }) {
  if (!summary) return null;

  const cards = isRange ? rangeCards : singleDayCards;

  return (
    <div className={`grid gap-3 ${isRange ? 'grid-cols-2 md:grid-cols-3 xl:grid-cols-5' : 'grid-cols-2 md:grid-cols-3 xl:grid-cols-5'}`}>
      {cards.map(({ key, label, icon: Icon, gradient }, i) => (
        <motion.div
          key={key}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04 }}
          className="relative overflow-hidden rounded-2xl border border-subtle bg-surface/80 backdrop-blur-xl p-4 min-h-[100px]"
        >
          <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-[0.07]`} />
          <div className="relative">
            <div className={`inline-flex p-2 rounded-xl bg-gradient-to-br ${gradient} text-white shadow-md mb-2`}>
              <Icon className="w-4 h-4" />
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-content-muted">{label}</p>
            <p className="text-2xl font-bold text-content-primary tabular-nums mt-0.5">{summary[key] ?? 0}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
