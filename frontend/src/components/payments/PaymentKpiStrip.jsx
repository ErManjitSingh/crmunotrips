import {
  IndianRupee,
  Wallet,
  Clock3,
  BadgePercent,
  AlertCircle,
  CalendarCheck2,
  RotateCcw,
  Gauge,
} from 'lucide-react';
import KpiCard from '../dashboard/KpiCard';

const ICONS = {
  revenue: IndianRupee,
  received: Wallet,
  pending: Clock3,
  advance: BadgePercent,
  outstanding: AlertCircle,
  today: CalendarCheck2,
  refund: RotateCcw,
  success: Gauge,
};

export default function PaymentKpiStrip({ kpis = [] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
      {kpis.map((kpi, index) => (
        <KpiCard
          key={kpi.key}
          index={index}
          compact
          label={kpi.label}
          value={kpi.value}
          change={kpi.change}
          changeType={kpi.changeType}
          changeLabel="vs last period"
          icon={ICONS[kpi.key] || IndianRupee}
          iconColor={kpi.iconColor}
          sparkColor={kpi.sparkColor}
          sparkData={kpi.sparkData}
        />
      ))}
    </div>
  );
}
