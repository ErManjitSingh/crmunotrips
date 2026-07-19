import { CalendarDays, Car, IndianRupee, Plane } from 'lucide-react';
import KpiCard from '../../dashboard/KpiCard';
import { buildSparkline, formatTransportPrice } from './transportListUtils';
import { cn } from '../../../lib/utils';

const KPI_ITEMS = [
  {
    key: 'totalVehicles',
    label: 'Total Vehicles',
    icon: Car,
    iconColor: 'bg-emerald-500',
    sparkColor: '#22C55E',
    change: 'Active in inventory',
    changeType: 'up',
    changeLabel: '',
  },
  {
    key: 'totalFlights',
    label: 'Total Flights',
    icon: Plane,
    iconColor: 'bg-violet-500',
    sparkColor: '#8B5CF6',
    change: 'Active in inventory',
    changeType: 'up',
    changeLabel: '',
  },
  {
    key: 'todaysBookings',
    label: "Today's Bookings",
    icon: CalendarDays,
    iconColor: 'bg-orange-500',
    sparkColor: '#F97316',
    change: 'Transport bookings',
    changeType: 'up',
    changeLabel: '',
  },
  {
    key: 'totalCostWeek',
    label: 'Total Cost (This Week)',
    icon: IndianRupee,
    iconColor: 'bg-blue-500',
    sparkColor: '#3B82F6',
    change: 'Transport expenses',
    changeType: 'up',
    changeLabel: '',
    format: 'currency',
  },
];

export default function TransportKpiStrip({ summary, loading }) {
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
    <div className={cn('grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 mb-5')}>
      {KPI_ITEMS.map((item, i) => (
        <KpiCard
          key={item.key}
          label={item.label}
          value={
            item.format === 'currency'
              ? formatTransportPrice(summary[item.key])
              : (summary[item.key] ?? 0).toLocaleString('en-IN')
          }
          change={item.change}
          changeType={item.changeType || 'up'}
          changeLabel={item.changeLabel ?? ''}
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
