import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Users, Inbox, UserCheck, Flame, XCircle, TrendingUp, Eye, UserPlus, RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../ui/button';
import AdminAssignLeadModal from '../leads/AdminAssignLeadModal';
import ReactivationActionsModal from '../lead-detail/ReactivationActionsModal';
import { useLeadAssign } from '../../hooks/useLeadAssign';
import { useLeadReactivate } from '../../hooks/useLeadReactivate';
import { TooltipProvider } from '../ui/tooltip';
import {
  createColumnHelper,
} from '@tanstack/react-table';
import API from '../../api/axios';
import { useRoleLeadsQuery } from '../../hooks/useRoleLeadsQuery';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import PageHeader from '../ui/PageHeader';
import { DEFAULT_PAGE_SIZE } from '../ui/TablePagination';
import VirtualizedRoleTable from '../ui/VirtualizedRoleTable';
import PriorityBadge from './PriorityBadge';
import {
  LeadIdPill,
  SourceBadge,
  DestinationChip,
  BudgetBadge,
  ExecutiveBadge,
  ManagerStatusBadge,
  CustomerCell,
  FILTER_THEMES,
} from './LeadListBadges';
import { ExecutiveStallIndicator, executiveStallRowClass } from './ExecutiveStallIndicator';
import { ReactivationFlowSteps, ReactivationEmptyState } from '../leads/ReactivationPanelUi';

const TITLES = {
  all: { title: 'All Team Leads', desc: 'Complete pipeline across your sales team', icon: Users },
  unassigned: { title: 'Unassigned Leads', desc: 'Leads waiting for executive assignment', icon: Inbox },
  assigned: { title: 'Assigned Leads', desc: 'Leads currently owned by executives', icon: UserCheck },
  hot: { title: 'Hot Leads', desc: 'High budget, urgent travel, and repeat customers', icon: Flame },
  lost: { title: 'Lost Leads', desc: 'Closed-lost opportunities for review', icon: XCircle },
};

const columnHelper = createColumnHelper();

export default function TeamLeadsPage() {
  const queryClient = useQueryClient();
  const { filter = 'all' } = useParams();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
  const [assignLead, setAssignLead] = useState(null);
  const [reactivateLead, setReactivateLead] = useState(null);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE });
  const meta = TITLES[filter] || TITLES.all;
  const theme = FILTER_THEMES[filter] || FILTER_THEMES.all;
  const Icon = meta.icon;
  const isLostView = filter === 'lost';

  const { data, isLoading } = useRoleLeadsQuery({
    endpoint: '/sales-manager/leads',
    filter,
    search: debouncedSearch,
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
  });

  const leads = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pagination.pageSize) || 1);

  const fetchLeads = () => queryClient.invalidateQueries({ queryKey: ['leads', '/sales-manager/leads'] });

  useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }, [filter, debouncedSearch]);

  const { assignees, assigneesLoading, handleAssign, assignConfirmDialog } = useLeadAssign({
    onAssigned: () => {
      setAssignLead(null);
      fetchLeads();
    },
  });

  const reactivate = useLeadReactivate({
    leadId: reactivateLead?._id,
    onSuccess: () => {
      setReactivateLead(null);
      fetchLeads();
    },
  });

  const reactivationExecs = assignees?.salesExecutives || [];

  const onConfirmAssign = async (payload) => {
    await handleAssign({
      ...payload,
      leadIds: payload.leadIds || (assignLead?._id ? [assignLead._id] : []),
    });
  };

  useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }, [filter, search, leads.length]);

  const columns = useMemo(() => [
    columnHelper.accessor('leadId', {
      header: 'Lead ID',
      cell: (i) => <LeadIdPill id={i.getValue()} />,
    }),
    columnHelper.accessor('name', {
      header: 'Customer',
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
          <CustomerCell name={row.original.name} lead={row.original} />
          <ExecutiveStallIndicator lead={row.original} />
          <PriorityBadge lead={row.original} />
        </div>
      ),
    }),
    columnHelper.accessor('destination', {
      header: 'Destination',
      cell: (i) => <DestinationChip name={i.getValue()} />,
    }),
    columnHelper.accessor('budget', {
      header: 'Budget',
      cell: (i) => <BudgetBadge amount={i.getValue()} />,
    }),
    columnHelper.accessor('sourceLabel', {
      header: 'Source',
      cell: ({ row }) => <SourceBadge source={row.original.source} label={row.original.sourceLabel} />,
    }),
    columnHelper.accessor('assignedTo', {
      header: 'Executive',
      cell: (i) => <ExecutiveBadge name={i.getValue()?.name} unassigned={!i.getValue()} />,
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: ({ row }) => <ManagerStatusBadge status={row.original.status} lead={row.original} />,
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Link
            to={`/sales-manager/leads/${row.original._id}/view`}
            className="inline-flex items-center h-7 px-2 rounded-md border border-subtle text-[11px] font-medium hover:bg-surface-elevated"
          >
            <Eye className="w-3 h-3 mr-0.5" /> View
          </Link>
          {reactivate.isLost(row.original) ? (
            <Button
              size="sm"
              variant="teal"
              className="h-7 px-2 text-[11px]"
              onClick={() => {
                setReactivateLead(row.original);
                reactivate.openReactivate();
              }}
            >
              <RefreshCw className="w-3 h-3 mr-0.5" /> Reactivate
            </Button>
          ) : (
            <Button size="sm" variant="gradient" className="h-7 px-2 text-[11px]" onClick={() => setAssignLead(row.original)}>
              <UserPlus className="w-3 h-3 mr-0.5" /> {row.original.assignedTo ? 'Reassign' : 'Assign'}
            </Button>
          )}
        </div>
      ),
    }),
  ], [reactivate, setReactivateLead, setAssignLead]);

  return (
    <div className="space-y-6">
      <PageHeader title={meta.title} description={meta.desc} breadcrumbs={['Sales Manager', 'Leads', meta.title]} />

      {isLostView && <ReactivationFlowSteps />}

      {/* Colorful filter banner */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={`relative overflow-hidden rounded-2xl border ${theme.border} bg-gradient-to-r ${theme.gradient} p-5 backdrop-blur-xl`}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl bg-surface/80 shadow-sm ${theme.icon}`}>
              <Icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-2xl font-bold text-content-primary tabular-nums">{isLoading ? '—' : total}</p>
              <p className="text-sm text-content-secondary">{meta.title}</p>
            </div>
          </div>
          {isLostView ? (
            <div className="flex items-center gap-2 text-sm font-semibold text-teal-700 bg-teal-500/10 px-3 py-1.5 rounded-full ring-1 ring-teal-500/25">
              <RefreshCw className="w-4 h-4" /> Reactivate to recover
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600 bg-emerald-500/10 px-3 py-1.5 rounded-full ring-1 ring-emerald-500/20">
              <TrendingUp className="w-4 h-4" /> Live pipeline
            </div>
          )}
        </div>
      </motion.div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-violet-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search leads…"
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-violet-500/20 bg-surface/80 backdrop-blur-xl text-sm outline-none focus:ring-2 focus:ring-violet-500/40 shadow-sm"
        />
      </div>

      {!isLoading && leads.length === 0 && isLostView ? (
        <ReactivationEmptyState isLost />
      ) : (
        <TooltipProvider delayDuration={0}>
          <VirtualizedRoleTable
            data={leads}
            columns={columns}
            isLoading={isLoading}
            pagination={pagination}
            pageCount={pageCount}
            total={total}
            onPaginationChange={setPagination}
            containerClassName={`rounded-2xl border ${theme.border} bg-surface/80 backdrop-blur-xl shadow-lg shadow-violet-500/5`}
            headerRowClassName={`border-b ${theme.border} bg-gradient-to-r ${theme.header}`}
            getRowClassName={executiveStallRowClass}
          />
        </TooltipProvider>
      )}

      <AdminAssignLeadModal
        open={!!assignLead}
        lead={assignLead}
        assignees={assignees}
        loading={assigneesLoading}
        onClose={() => setAssignLead(null)}
        onAssign={onConfirmAssign}
        allowedRoles={['sales_manager', 'team_leader', 'sales_executive']}
      />
      <ReactivationActionsModal
        open={!!reactivateLead && reactivate.mode === 'reactivate'}
        mode="reactivate"
        lead={reactivateLead}
        executives={reactivationExecs}
        executivesLoading={assigneesLoading}
        onClose={() => {
          reactivate.close();
          setReactivateLead(null);
        }}
        onSubmit={reactivate.submit}
      />
      {assignConfirmDialog}
    </div>
  );
}
