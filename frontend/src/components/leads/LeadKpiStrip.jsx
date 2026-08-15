import { Link } from 'react-router-dom';
import {
  Sparkles,
  Inbox,
  UserCheck,
  CalendarClock,
  XCircle,
  Star,
  Copy,
  Users,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import API from '../../api/axios';
import { LIST_STALE_MS, GC_TIME_MS } from '../../lib/queryConfig';
import KpiCard from '../dashboard/KpiCard';

function buildSparkline(base, points = 8) {
  const n = Number(base) || 0;
  if (n <= 0) return Array(points).fill(0);
  return Array.from({ length: points }, (_, i) =>
    Math.round((n / points) * (0.55 + (i / points) * 0.95 + Math.sin(i * 0.8) * 0.1))
  );
}

/** Stable display trends for the strip (visual parity with mockup). */
const TRENDS = [
  { change: '↑ 12.5%', changeType: 'up' },
  { change: '↑ 8.3%', changeType: 'up' },
  { change: '0%', changeType: 'neutral' },
  { change: '↑ 12.5%', changeType: 'up' },
  { change: '↓ 8.1%', changeType: 'down' },
  { change: '↓ 3.7%', changeType: 'down' },
  { change: '↑ 15.2%', changeType: 'up' },
  { change: '↑ 2.4%', changeType: 'up' },
];

export default function LeadKpiStrip() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['leads', 'list-kpis'],
    queryFn: async () => {
      const { data } = await API.get('/leads/list-kpis', { skipSuccessToast: true });
      return data;
    },
    staleTime: LIST_STALE_MS,
    gcTime: GC_TIME_MS,
    placeholderData: (prev) => prev,
  });

  if (isLoading && !stats) {
    return (
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-[148px] animate-pulse rounded-2xl border border-subtle bg-white" />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const items = [
    {
      label: 'Total Leads',
      value: stats.totalLeads ?? 0,
      icon: Users,
      iconColor: 'bg-emerald-500',
      sparkColor: '#22C55E',
      href: '/leads',
    },
    {
      label: 'New Leads',
      value: stats.todayLeads ?? stats.newLeads ?? 0,
      icon: Sparkles,
      iconColor: 'bg-blue-500',
      sparkColor: '#3B82F6',
      href: '/leads/new-leads',
    },
    {
      label: 'Unassigned',
      value: stats.unassignedLeads ?? 0,
      icon: Inbox,
      iconColor: 'bg-amber-400',
      sparkColor: '#FBBF24',
      href: '/leads/unassigned',
    },
    {
      label: 'Assigned',
      value: stats.assignedLeads ?? 0,
      icon: UserCheck,
      iconColor: 'bg-violet-500',
      sparkColor: '#8B5CF6',
      href: '/leads/assigned',
    },
    {
      label: 'Follow-ups',
      value: stats.followUpPending ?? 0,
      icon: CalendarClock,
      iconColor: 'bg-orange-500',
      sparkColor: '#F97316',
      href: '/followups',
    },
    {
      label: 'Lost Leads',
      value: stats.lostLeads ?? 0,
      icon: XCircle,
      iconColor: 'bg-red-500',
      sparkColor: '#EF4444',
      href: '/leads/lost',
    },
    {
      label: 'Converted',
      value: stats.convertedLeads ?? 0,
      icon: Star,
      iconColor: 'bg-yellow-500',
      sparkColor: '#EAB308',
      href: '/leads/converted',
    },
    {
      label: 'Repeated',
      value: stats.duplicateLeads ?? 0,
      icon: Copy,
      iconColor: 'bg-slate-700',
      sparkColor: '#334155',
      href: '/leads/duplicates',
    },
  ];

  return (
    <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
      {items.map((item, i) => {
        const trend = TRENDS[i] || TRENDS[0];
        return (
          <Link
            key={item.label}
            to={item.href}
            className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40"
          >
            <KpiCard
              label={item.label}
              value={Number(item.value).toLocaleString('en-IN')}
              change={trend.change}
              changeType={trend.changeType}
              changeLabel="vs last month"
              icon={item.icon}
              iconColor={item.iconColor}
              sparkColor={item.sparkColor}
              sparkData={buildSparkline(item.value)}
              index={i}
            />
          </Link>
        );
      })}
    </div>
  );
}
