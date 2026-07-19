import { CalendarClock, CheckCircle2, Plane, XCircle } from 'lucide-react';
import KpiCard from '../../dashboard/KpiCard';
import { buildSparkline } from '../bookings/bookingListUtils';

const KPI_ITEMS = [
  { key: 'upcoming', label: 'Upcoming Trips', icon: CalendarClock, iconColor: 'bg-emerald-500', sparkColor: '#22C55E', change: '↑ 12%', changeLabel: 'vs last 7 days' },
  { key: 'ongoing', label: 'Ongoing Trips', icon: Plane, iconColor: 'bg-blue-500', sparkColor: '#3B82F6', change: 'On trip now', changeType: 'up', changeLabel: '' },
  { key: 'completed', label: 'Completed Trips', icon: CheckCircle2, iconColor: 'bg-violet-500', sparkColor: '#8B5CF6', change: '↑ 8%', changeLabel: 'vs last 30 days' },
  { key: 'cancelled', label: 'Cancelled Trips', icon: XCircle, iconColor: 'bg-rose-500', sparkColor: '#EF4444', change: 'No change', changeType: 'neutral', changeLabel: '' },
];

export default function TripTrackerKpiStrip({ summary, loading }) {
  if (loading && !summary) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 mb-5">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl bg-white border border-subtle animate-pulse h-[88px]" />
        ))}
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 mb-5">
      {KPI_ITEMS.map((item, i) => (
        <KpiCard
          key={item.key}
          label={item.label}
          value={(summary[item.key] ?? 0).toLocaleString('en-IN')}
          change={item.change}
          changeType={item.changeType || 'up'}
          changeLabel={item.changeLabel ?? 'vs last 7 days'}
          icon={item.icon}
          iconColor={item.iconColor}
          sparkColor={item.sparkColor}
          sparkData={buildSparkline(summary[item.key])}
          index={i}
          compact
        />
      ))}
    </div>
  );
}
