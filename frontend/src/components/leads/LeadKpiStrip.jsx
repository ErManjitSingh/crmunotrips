import { Users, IndianRupee, CheckCircle2, TrendingUp } from 'lucide-react';
import { useDashboardQuery } from '../../features/dashboard/hooks/useDashboardQuery';
import KpiCard from '../dashboard/KpiCard';

function formatCurrency(n) {
  if (!n) return '₹0';
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n.toLocaleString('en-IN')}`;
}

function buildSparkline(base, points = 8) {
  if (!base || base <= 0) return Array(points).fill(0);
  return Array.from({ length: points }, (_, i) =>
    Math.round((base / points) * (0.6 + (i / points) * 0.9 + Math.sin(i) * 0.12))
  );
}

export default function LeadKpiStrip() {
  const { data: stats, isLoading } = useDashboardQuery();

  if (isLoading && !stats) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 mb-5">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-[88px] rounded-xl bg-white border border-subtle animate-pulse" />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const items = [
    {
      label: 'Total Leads',
      value: stats.totalLeads ?? 0,
      change: '+18.5%',
      icon: Users,
      iconColor: 'bg-blue-500',
      sparkColor: '#3B82F6',
      spark: stats.totalLeads,
    },
    {
      label: 'Total Value',
      value: formatCurrency(stats.totalBudget ?? stats.revenue),
      change: '+24.6%',
      icon: IndianRupee,
      iconColor: 'bg-emerald-500',
      sparkColor: '#22C55E',
      spark: stats.totalBudget ?? stats.revenue,
    },
    {
      label: 'Converted Leads',
      value: stats.convertedLeads ?? 0,
      change: '+15.2%',
      icon: CheckCircle2,
      iconColor: 'bg-orange-500',
      sparkColor: '#F97316',
      spark: stats.convertedLeads,
    },
    {
      label: 'Conversion Rate',
      value: `${stats.conversionRate ?? 0}%`,
      change: '+3.8%',
      icon: TrendingUp,
      iconColor: 'bg-violet-500',
      sparkColor: '#8B5CF6',
      spark: stats.conversionRate,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 mb-5">
      {items.map((item, i) => (
        <KpiCard
          key={item.label}
          label={item.label}
          value={item.value}
          change={item.change}
          changeType="up"
          icon={item.icon}
          iconColor={item.iconColor}
          sparkColor={item.sparkColor}
          sparkData={buildSparkline(typeof item.spark === 'number' ? item.spark : 0)}
          index={i}
          compact
        />
      ))}
    </div>
  );
}
