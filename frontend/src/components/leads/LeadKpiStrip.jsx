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
import { cn } from '../../lib/utils';

function CompactKpi({ label, value, icon: Icon, iconColor, href, index = 0 }) {
  const inner = (
    <>
      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm', iconColor)}>
        <Icon className="h-4 w-4 text-white" strokeWidth={2.25} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <p className="metric-tabular mt-0.5 truncate text-lg font-bold leading-none tracking-tight text-slate-900">
          {value}
        </p>
      </div>
    </>
  );

  const className = cn(
    'group relative flex items-center gap-2.5 rounded-xl border border-subtle bg-white px-3 py-2.5 shadow-sm',
    'transition-all duration-200 hover:border-slate-300 hover:shadow-md',
    href && 'cursor-pointer'
  );

  if (href) {
    return (
      <Link to={href} className={className} style={{ animationDelay: `${index * 40}ms` }}>
        {inner}
      </Link>
    );
  }

  return (
    <div className={className} style={{ animationDelay: `${index * 40}ms` }}>
      {inner}
    </div>
  );
}

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
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-[58px] animate-pulse rounded-xl border border-subtle bg-white" />
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
      href: '/leads',
    },
    {
      label: 'New Leads',
      value: stats.todayLeads ?? stats.newLeads ?? 0,
      icon: Sparkles,
      iconColor: 'bg-blue-500',
      href: '/leads/new-leads',
    },
    {
      label: 'Unassigned Leads',
      value: stats.unassignedLeads ?? 0,
      icon: Inbox,
      iconColor: 'bg-amber-400',
      href: '/leads/unassigned',
    },
    {
      label: 'Assigned Leads',
      value: stats.assignedLeads ?? 0,
      icon: UserCheck,
      iconColor: 'bg-violet-500',
      href: '/leads/assigned',
    },
    {
      label: 'Follow-up Pending',
      value: stats.followUpPending ?? 0,
      icon: CalendarClock,
      iconColor: 'bg-orange-500',
      href: '/followups',
    },
    {
      label: 'Lost Leads',
      value: stats.lostLeads ?? 0,
      icon: XCircle,
      iconColor: 'bg-red-500',
      href: '/leads/lost',
    },
    {
      label: 'Converted Leads',
      value: stats.convertedLeads ?? 0,
      icon: Star,
      iconColor: 'bg-yellow-500',
      href: '/leads/converted',
    },
    {
      label: 'Repeated Leads',
      value: stats.duplicateLeads ?? 0,
      icon: Copy,
      iconColor: 'bg-slate-700',
      href: '/leads/duplicates',
    },
  ];

  return (
    <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
      {items.map((item, i) => (
        <CompactKpi
          key={item.label}
          label={item.label}
          value={item.value}
          icon={item.icon}
          iconColor={item.iconColor}
          href={item.href}
          index={i}
        />
      ))}
    </div>
  );
}
