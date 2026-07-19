import {
  Clock,
  IndianRupee,
  Users,
  CalendarDays,
  CheckCircle2,
  Building2,
  Car,
  Plane,
  Hotel,
  MapPin,
  CircleCheck,
  Ticket,
  BadgeCheck,
} from 'lucide-react';
import KpiCard from '../../dashboard/KpiCard';
import { buildSparkline, formatINRCompact, formatPercent } from './bookingListUtils';
import { cn } from '../../../lib/utils';

function buildConfirmedKpis(summary) {
  const count = summary?.count || 0;
  const hotelsConfirmed = summary?.hotelsConfirmed || 0;
  const cabsConfirmed = summary?.cabsConfirmed || 0;

  return [
    { key: 'count', label: 'Total Confirmed', icon: CheckCircle2, iconColor: 'bg-emerald-500', sparkColor: '#22C55E', change: '↑ 24.6%', changeLabel: 'vs last 7 days', format: (v) => v?.toLocaleString('en-IN') ?? '0' },
    { key: 'totalAmount', label: 'Total Revenue', icon: IndianRupee, iconColor: 'bg-blue-500', sparkColor: '#3B82F6', change: '↑ 18.3%', changeLabel: 'vs last 7 days', format: (v) => formatINRCompact(v) },
    { key: 'totalPax', label: 'Total Pax', icon: Users, iconColor: 'bg-violet-500', sparkColor: '#8B5CF6', change: '↑ 12.7%', changeLabel: 'vs last 7 days', format: (v) => v?.toLocaleString('en-IN') ?? '0' },
    { key: 'hotelsConfirmed', label: 'Hotels Confirmed', icon: Building2, iconColor: 'bg-orange-500', sparkColor: '#F97316', change: `${formatPercent(hotelsConfirmed, count)} confirmed`, changeType: 'up', changeLabel: '', format: (v) => v?.toLocaleString('en-IN') ?? '0' },
    { key: 'cabsConfirmed', label: 'Cabs Confirmed', icon: Car, iconColor: 'bg-sky-500', sparkColor: '#0EA5E9', change: `${formatPercent(cabsConfirmed, count)} confirmed`, changeType: 'up', changeLabel: '', format: (v) => v?.toLocaleString('en-IN') ?? '0' },
  ];
}

function buildActiveKpis(summary) {
  return [
    { key: 'count', label: 'Active Trips', icon: Plane, iconColor: 'bg-blue-500', sparkColor: '#3B82F6', change: '↑ 12.5%', changeLabel: 'vs yesterday', format: (v) => v?.toLocaleString('en-IN') ?? '0' },
    { key: 'totalPax', label: 'Total Guests', icon: Users, iconColor: 'bg-emerald-500', sparkColor: '#22C55E', change: '↑ 8.2%', changeLabel: 'on trip now', format: (v) => v?.toLocaleString('en-IN') ?? '0' },
    { key: 'todayOnTrip', label: 'On Trip Today', icon: MapPin, iconColor: 'bg-violet-500', sparkColor: '#8B5CF6', change: 'On today', changeType: 'up', changeLabel: '', format: (v) => v?.toLocaleString('en-IN') ?? '0' },
    { key: 'hotelsPending', label: 'Hotels Pending', icon: Hotel, iconColor: 'bg-orange-500', sparkColor: '#F97316', change: 'Pending', changeType: 'up', changeLabel: '', format: (v) => v?.toLocaleString('en-IN') ?? '0' },
    { key: 'cabsPending', label: 'Cabs Pending', icon: Car, iconColor: 'bg-cyan-500', sparkColor: '#06B6D4', change: 'Pending', changeType: 'up', changeLabel: '', format: (v) => v?.toLocaleString('en-IN') ?? '0' },
    { key: 'returningToday', label: 'Returning Today', icon: CalendarDays, iconColor: 'bg-rose-500', sparkColor: '#F43F5E', change: 'Departures', changeType: 'up', changeLabel: '', format: (v) => v?.toLocaleString('en-IN') ?? '0' },
  ];
}

const KPI_CONFIG = {
  pending: [
    { key: 'count', label: 'Total Pending', icon: Clock, iconColor: 'bg-blue-500', sparkColor: '#3B82F6', change: '↑ 18.2%', changeLabel: 'vs last 7 days', format: (v) => v?.toLocaleString('en-IN') ?? '0' },
    { key: 'totalAmount', label: 'Total Amount', icon: IndianRupee, iconColor: 'bg-emerald-500', sparkColor: '#22C55E', change: '↑ 24.6%', changeLabel: 'vs last 7 days', format: (v) => formatINRCompact(v) },
    { key: 'totalPax', label: 'Total Pax', icon: Users, iconColor: 'bg-violet-500', sparkColor: '#8B5CF6', change: '↘ 12.4%', changeType: 'down', changeLabel: 'vs last 7 days', format: (v) => v?.toLocaleString('en-IN') ?? '0' },
    { key: 'todayPending', label: "Today's Pending", icon: CalendarDays, iconColor: 'bg-orange-500', sparkColor: '#F97316', change: '↑ 20%', changeLabel: 'vs last 7 days', format: (v) => v?.toLocaleString('en-IN') ?? '0' },
  ],
};

function buildCompletedKpis(summary) {
  const count = summary?.count || 0;
  const vouchersIssued = summary?.vouchersIssued || 0;
  const paidInFull = summary?.paidInFull || 0;

  return [
    { key: 'count', label: 'Total Completed', icon: CircleCheck, iconColor: 'bg-slate-600', sparkColor: '#64748B', change: '↑ 8.4%', changeLabel: 'vs last 30 days', format: (v) => v?.toLocaleString('en-IN') ?? '0' },
    { key: 'totalAmount', label: 'Total Revenue', icon: IndianRupee, iconColor: 'bg-emerald-500', sparkColor: '#22C55E', change: '↑ 15.2%', changeLabel: 'vs last 30 days', format: (v) => formatINRCompact(v) },
    { key: 'totalPax', label: 'Guests Served', icon: Users, iconColor: 'bg-violet-500', sparkColor: '#8B5CF6', change: '↑ 10.1%', changeLabel: 'vs last 30 days', format: (v) => v?.toLocaleString('en-IN') ?? '0' },
    { key: 'completedThisMonth', label: 'Completed This Month', icon: CalendarDays, iconColor: 'bg-blue-500', sparkColor: '#3B82F6', change: 'This month', changeType: 'up', changeLabel: '', format: (v) => v?.toLocaleString('en-IN') ?? '0' },
    { key: 'vouchersIssued', label: 'Vouchers Issued', icon: Ticket, iconColor: 'bg-purple-500', sparkColor: '#A855F7', change: `${formatPercent(vouchersIssued, count)} issued`, changeType: 'up', changeLabel: '', format: (v) => v?.toLocaleString('en-IN') ?? '0' },
    { key: 'paidInFull', label: 'Paid in Full', icon: BadgeCheck, iconColor: 'bg-teal-500', sparkColor: '#14B8A6', change: `${formatPercent(paidInFull, count)} collected`, changeType: 'up', changeLabel: '', format: (v) => v?.toLocaleString('en-IN') ?? '0' },
  ];
}

function resolveItems(status, summary) {
  if (status === 'confirmed') return buildConfirmedKpis(summary);
  if (status === 'active') return buildActiveKpis(summary);
  if (status === 'completed') return buildCompletedKpis(summary);
  return KPI_CONFIG[status] || KPI_CONFIG.pending;
}

export default function BookingKpiStrip({ summary, status = 'pending', loading }) {
  const items = resolveItems(status, summary);
  const colClass =
    items.length >= 6 ? 'xl:grid-cols-6' : items.length >= 5 ? 'xl:grid-cols-5' : 'xl:grid-cols-4';

  if (loading && !summary) {
    return (
      <div className={cn('grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-5', colClass)}>
        {[...Array(items.length || 4)].map((_, i) => (
          <div key={i} className="rounded-xl bg-white border border-subtle animate-pulse h-[88px]" />
        ))}
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className={cn('grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-5', colClass)}>
      {items.map((item, i) => (
        <KpiCard
          key={item.key}
          label={item.label}
          value={item.format(summary[item.key])}
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
