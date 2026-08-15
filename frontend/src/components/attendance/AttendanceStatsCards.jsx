import { UserCheck, UserX, Clock, BedDouble } from 'lucide-react';
import { cn } from '../../lib/utils';

const CARDS = [
  {
    key: 'presentToday',
    label: 'Present',
    icon: UserCheck,
    iconWrap: 'bg-emerald-100 text-emerald-600',
    value: 'text-emerald-700',
  },
  {
    key: 'absentToday',
    label: 'Absent',
    icon: UserX,
    iconWrap: 'bg-rose-100 text-rose-600',
    value: 'text-rose-700',
  },
  {
    key: 'lateToday',
    label: 'Late',
    icon: Clock,
    iconWrap: 'bg-orange-100 text-orange-600',
    value: 'text-orange-700',
  },
  {
    key: 'onLeaveToday',
    label: 'On Leave',
    icon: BedDouble,
    iconWrap: 'bg-sky-100 text-sky-600',
    value: 'text-sky-700',
  },
];

export default function AttendanceStatsCards({ summary }) {
  if (!summary) return null;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {CARDS.map(({ key, label, icon: Icon, iconWrap, value }) => (
        <div
          key={key}
          className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3.5 shadow-sm"
        >
          <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', iconWrap)}>
            <Icon className="h-5 w-5" strokeWidth={2.25} />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-slate-500">{label}</p>
            <p className={cn('text-2xl font-bold tabular-nums leading-tight', value)}>
              {summary[key] ?? 0}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
