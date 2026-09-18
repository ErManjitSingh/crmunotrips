import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Users, Sparkles, Flame, Loader, AlertTriangle } from 'lucide-react';
import { useSidebarCounts } from '../../hooks/useSidebarCounts';
import API from '../../api/axios';
import { buildListParams } from '../../utils/apiHelpers';
import { LIST_STALE_MS, GC_TIME_MS } from '../../lib/queryConfig';

const CARDS = [
  { key: 'all', label: 'Total Leads', hint: 'All team leads', icon: Users, iconBg: 'bg-[#5D5FEF]', path: '/sales-manager/leads/all' },
  { key: 'statusNew', label: 'New Leads', hint: 'Awaiting first contact', icon: Sparkles, iconBg: 'bg-sky-500', path: '/sales-manager/leads/all?status=new' },
  { key: 'hot', label: 'Hot Leads', hint: 'High priority', icon: Flame, iconBg: 'bg-orange-500', path: '/sales-manager/leads/hot' },
  { key: 'workingProgress', label: 'Work in Progress', hint: 'Cold leads moved back to Warm', icon: Loader, iconBg: 'bg-violet-500', path: '/sales-manager/leads/working-progress' },
  { key: 'needsAttention', label: 'Urgent Leads', hint: 'Need attention', icon: AlertTriangle, iconBg: 'bg-rose-500', urgent: true, path: '/sales-manager/follow-ups' },
];

function getCount(counts, key) {
  return counts?.leads?.[key] ?? 0;
}

export default function ManagerLeadKpiStrip({ basePath = '/sales-manager/leads', filters }) {
  // Sidebar counts are global (whole branch, no Filters-panel awareness) — the default source,
  // used as-is by every other caller of this component (e.g. Team Leader's own page). When the
  // Sales Manager "All Leads" tab passes its current `filters`, these cards switch to a
  // dedicated, filter-aware endpoint instead — same effective filter the Leads List itself
  // queries with (see roleScopedRepository.buildEffectiveManagerLeadFilter), so Total/New/Hot/
  // Work in Progress/Urgent always match what's actually shown below, not the whole team's data.
  const sidebarCounts = useSidebarCounts(!filters);

  const kpiParams = filters ? buildListParams({ filters }) : null;
  const { data: filteredKpis } = useQuery({
    queryKey: ['sales-manager', 'leads-list-kpis', kpiParams],
    queryFn: async () => {
      const { data } = await API.get('/sales-manager/leads/list-kpis', {
        params: kpiParams,
        skipSuccessToast: true,
      });
      return data;
    },
    enabled: Boolean(filters),
    staleTime: LIST_STALE_MS,
    gcTime: GC_TIME_MS,
  });

  const counts = filters
    ? {
        leads: {
          all: filteredKpis?.all ?? 0,
          statusNew: filteredKpis?.statusNew ?? 0,
          hot: filteredKpis?.hot ?? 0,
          workingProgress: filteredKpis?.workingProgress ?? 0,
          needsAttention: filteredKpis?.needsAttention ?? 0,
        },
      }
    : sidebarCounts;

  const cards = CARDS.map((card) => {
    if (basePath === '/team-leader/leads') {
      if (card.key === 'all') return { ...card, path: '/team-leader/leads' };
      if (card.key === 'statusNew') return { ...card, path: '/team-leader/leads?status=new' };
      if (card.key === 'hot') return { ...card, path: '/team-leader/leads/hot' };
      if (card.key === 'workingProgress') return { ...card, path: '/team-leader/leads/working-progress' };
      if (card.key === 'needsAttention') return { ...card, path: '/team-leader/follow-ups' };
    }
    return card;
  });

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2.5 flex-1 min-w-0">
      {cards.map(({ key, label, hint, icon: Icon, iconBg, urgent, path }, i) => {
        const value = getCount(counts, key);
        return (
          <motion.div
            key={key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
          >
            <Link
              to={path}
              className={`block rounded-xl border bg-white dark:bg-slate-900 shadow-sm p-3 min-h-[88px] flex flex-col cursor-pointer transition hover:-translate-y-0.5 hover:shadow-md ${
                urgent ? 'border-rose-500/25 ring-1 ring-rose-500/10' : 'border-subtle'
              }`}
            >
              <div className={`inline-flex w-8 h-8 items-center justify-center rounded-lg ${iconBg} text-white shadow-sm mb-2`}>
                <Icon className="w-4 h-4" strokeWidth={2} />
              </div>
              <p className="text-[10px] font-medium text-content-muted leading-tight">{label}</p>
              <p className={`text-xl font-bold tabular-nums mt-0.5 leading-none ${urgent ? 'text-rose-600 dark:text-rose-400' : 'text-content-primary'}`}>
                {value}
              </p>
              <p className={`text-[9px] mt-1 ${urgent ? 'text-rose-600/80 dark:text-rose-400/80 font-medium' : 'text-content-muted'}`}>
                {hint}
              </p>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}
