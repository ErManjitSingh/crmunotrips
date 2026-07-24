import { Users, IndianRupee, CheckCircle2, TrendingUp } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import API from '../../api/axios';
import { LIST_STALE_MS, GC_TIME_MS } from '../../lib/queryConfig';
import { cn } from '../../lib/utils';

function formatCurrency(n) {
  if (!n) return '₹0';
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n.toLocaleString('en-IN')}`;
}

function CompactKpi({ label, value, change, icon: Icon, iconColor, index = 0 }) {
  return (
    <div
      className={cn(
        'group relative flex items-center gap-2.5 rounded-xl border border-subtle bg-white px-3 py-2.5 shadow-sm',
        'hover:shadow-md hover:border-sky-200/80 transition-all duration-200'
      )}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm', iconColor)}>
        <Icon className="w-3.5 h-3.5 text-white" strokeWidth={2.25} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 truncate">{label}</p>
          {change !== undefined && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold shrink-0 text-emerald-600">
              <TrendingUp className="w-2.5 h-2.5" />
              {change}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-base font-bold text-slate-900 metric-tabular tracking-tight leading-none truncate">
          {value}
        </p>
      </div>
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
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2 mb-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-[52px] rounded-xl bg-white border border-subtle animate-pulse" />
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
    },
    {
      label: 'Total Value',
      value: formatCurrency(stats.totalBudget),
      change: '+24.6%',
      icon: IndianRupee,
      iconColor: 'bg-emerald-500',
    },
    {
      label: 'Converted Leads',
      value: stats.convertedLeads ?? 0,
      change: '+15.2%',
      icon: CheckCircle2,
      iconColor: 'bg-orange-500',
    },
    {
      label: 'Conversion Rate',
      value: `${stats.conversionRate ?? 0}%`,
      change: '+3.8%',
      icon: TrendingUp,
      iconColor: 'bg-violet-500',
    },
  ];

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-2 mb-4">
      {items.map((item, i) => (
        <CompactKpi
          key={item.label}
          label={item.label}
          value={item.value}
          change={item.change}
          icon={item.icon}
          iconColor={item.iconColor}
          index={i}
        />
      ))}
    </div>
  );
}
