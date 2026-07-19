import { Building2, Globe2, Layers, Star } from 'lucide-react';
import KpiCard from '../../dashboard/KpiCard';
import { buildSparkline } from './hotelListUtils';
import { cn } from '../../../lib/utils';

const KPI_ITEMS = [
  { key: 'count', label: 'Total Hotels', icon: Building2, iconColor: 'bg-emerald-500', sparkColor: '#22C55E', change: '↑ 6.2%', changeLabel: 'vs last month' },
  { key: 'partnerHotels', label: 'Partner Hotels', icon: Star, iconColor: 'bg-violet-500', sparkColor: '#8B5CF6', change: 'Active partners', changeType: 'up', changeLabel: '' },
  { key: 'topCategories', label: 'Top Categories', icon: Layers, iconColor: 'bg-orange-500', sparkColor: '#F97316', change: 'Categories', changeType: 'up', changeLabel: '' },
  { key: 'destinations', label: 'Destinations', icon: Globe2, iconColor: 'bg-blue-500', sparkColor: '#3B82F6', change: 'Covered', changeType: 'up', changeLabel: '' },
];

export default function HotelKpiStrip({ summary, loading }) {
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
          value={(summary[item.key] ?? 0).toLocaleString('en-IN')}
          change={item.change}
          changeType={item.changeType || 'up'}
          changeLabel={item.changeLabel ?? 'vs last month'}
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
