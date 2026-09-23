import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, Inbox, UserCheck, Flame, XCircle, TrendingUp, Eye, UserPlus, RefreshCw, Undo2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../ui/button';
import AdminAssignLeadModal from '../leads/AdminAssignLeadModal';
import ReactivationActionsModal from '../lead-detail/ReactivationActionsModal';
import { useLeadAssign } from '../../hooks/useLeadAssign';
import { useLeadReactivate } from '../../hooks/useLeadReactivate';
import { TooltipProvider } from '../ui/tooltip';
import { createColumnHelper } from '@tanstack/react-table';
import { useRoleLeadsQuery } from '../../hooks/useRoleLeadsQuery';
import { useLeadsQuery } from '../../features/leads/hooks/useLeadsQuery';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import PageHeader from '../ui/PageHeader';
import { DEFAULT_PAGE_SIZE } from '../ui/TablePagination';
import VirtualizedRoleTable from '../ui/VirtualizedRoleTable';
import PriorityBadge from './PriorityBadge';
import ManagerLeadKpiStrip from './ManagerLeadKpiStrip';
import ManagerPipelineCard from './ManagerPipelineCard';
import LeadFilterBar from '../leads/LeadFilterBar';
import { emptyFilters } from '../leads/constants';
import { countActiveFilters } from '../leads/leadFilters';
import { applyPeriodPreset } from '../../lib/periodFilters';
import {
  LeadIdPill,
  SourceBadge,
  DestinationChip,
  MealPlanBadge,
  BudgetBadge,
  ExecutiveBadge,
  ManagerStatusBadge,
  CustomerCell,
  PhoneCell,
  TravelDateCell,
  TravelersBadge,
  formatFollowUpDate,
  FILTER_THEMES,
} from './LeadListBadges';
import { ExecutiveStallIndicator, executiveStallRowClass } from './ExecutiveStallIndicator';
import { ReactivationFlowSteps, ReactivationEmptyState } from '../leads/ReactivationPanelUi';
import PeriodPresetChips from '../ui/PeriodPresetChips';
import { useUrlPeriodFilter } from '../../hooks/useUrlPeriodFilter';

const TITLES = {
  all: { title: 'All Team Leads', desc: 'Complete pipeline across your sales team', icon: Users },
  returned: {
    title: 'Unassigned Leads',
    desc: 'Leads waiting to be reassigned',
    icon: Undo2,
  },
  unassigned: { title: 'Unassigned Leads', desc: 'Leads waiting for executive assignment', icon: Inbox },
  assigned: { title: 'Assigned Leads', desc: 'Leads currently owned by executives', icon: UserCheck },
  'working-progress': { title: 'Work in Progress', desc: 'Cold leads moved back to Warm', icon: TrendingUp },
  hot: { title: 'Hot Leads', desc: 'High budget, urgent travel, and repeat customers', icon: Flame },
  lost: { title: 'Lost Leads', desc: 'Closed-lost opportunities for review', icon: XCircle },
};

const columnHelper = createColumnHelper();

export default function TeamLeadsPage() {
  const queryClient = useQueryClient();
  const { filter = 'all' } = useParams();
  const [searchParams] = useSearchParams();
  const [bucketSearch, setBucketSearch] = useState('');
  const [filters, setFilters] = useState(() => ({
    ...emptyFilters,
    status: searchParams.get('status') || '',
    search: searchParams.get('search') || '',
  }));
  const [appliedFilters, setAppliedFilters] = useState(() => ({
    ...emptyFilters,
    status: searchParams.get('status') || '',
    search: searchParams.get('search') || '',
  }));
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const { dateFrom, dateTo, setPeriod } = useUrlPeriodFilter();
  const debouncedBucketSearch = useDebouncedValue(bucketSearch, 350);
  const [assignLead, setAssignLead] = useState(null);
  const [reactivateLead, setReactivateLead] = useState(null);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE });
  const meta = TITLES[filter] || TITLES.all;
  const theme = FILTER_THEMES[filter] || FILTER_THEMES.all;
  const Icon = meta.icon;
  const isLostView = filter === 'lost';
  const isAllView = filter === 'all';

  // "All Leads" gets the same rich filter set (and the same /sales-manager/leads endpoint
  // param handling) as Admin's Lead Management — see useLeadsQuery/buildLeadListFilter.
  // Branch is sent as `leadBranchId`, NOT `branchId`: the generic `branchId` query param is
  // inspected by the auth middleware for org-wide branch-switching and would 403 a Sales
  // Manager (a non-org-wide role) the moment they pick any branch other than their own. This
  // list-scoped rename keeps that org-wide mechanism completely untouched.
  const allLeadsFilters = useMemo(() => {
    const { branchId, ...rest } = appliedFilters;
    return branchId ? { ...rest, leadBranchId: branchId } : rest;
  }, [appliedFilters]);

  const allLeadsQuery = useLeadsQuery({
    filters: allLeadsFilters,
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    endpoint: '/sales-manager/leads',
    enabled: isAllView,
  });

  // Other buckets (unassigned/assigned/hot/lost/reactivated/returned/working-progress) keep
  // their existing simple search + period filtering, unchanged.
  const bucketLeadsQuery = useRoleLeadsQuery({
    endpoint: '/sales-manager/leads',
    filter,
    search: debouncedBucketSearch,
    dateFrom,
    dateTo,
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    enabled: !isAllView,
  });

  const { data, isLoading } = isAllView ? allLeadsQuery : bucketLeadsQuery;

  const leads = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pagination.pageSize) || 1);

  const fetchLeads = () => queryClient.invalidateQueries({ queryKey: ['leads', '/sales-manager/leads'] });

  // Deep links into this page (KPI cards / command bar) carry ?status= / ?search=
  useEffect(() => {
    const status = searchParams.get('status') || '';
    const search = searchParams.get('search') || '';
    setFilters((f) => ({ ...f, status, search }));
    setAppliedFilters((f) => ({ ...f, status, search }));
  }, [searchParams]);

  useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }, [filter, debouncedBucketSearch, appliedFilters, dateFrom, dateTo]);

  const handleApply = () => setAppliedFilters({ ...filters });
  const handleReset = () => {
    const base = { ...emptyFilters };
    setFilters(base);
    setAppliedFilters(base);
  };
  const handlePeriodSelect = (key) => {
    const next = { ...filters, ...applyPeriodPreset(key) };
    setFilters(next);
    setAppliedFilters(next);
  };
  const handleQuickFilter = (next) => {
    setFilters(next);
    setAppliedFilters(next);
  };

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

  const toggleRow = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const columns = useMemo(() => {
    const base = [];

    if (isAllView) {
      base.push(
        columnHelper.display({
          id: 'select',
          header: '',
          cell: ({ row }) => (
            <input
              type="checkbox"
              checked={selectedIds.has(row.original._id)}
              onChange={() => toggleRow(row.original._id)}
              className="rounded border-subtle text-[#5D5FEF] focus:ring-[#5D5FEF]/30"
              aria-label={`Select ${row.original.name}`}
            />
          ),
        })
      );
    }

    base.push(
      columnHelper.accessor('leadId', {
        header: 'Lead ID',
        cell: ({ row }) => <LeadIdPill id={row.original.leadId} lead={row.original} />,
      }),
      columnHelper.accessor('name', {
        header: 'Customer',
        cell: ({ row }) => (
          <div className="space-y-1.5 min-w-0">
            <CustomerCell name={row.original.name} lead={row.original} />
            <div className="flex items-center gap-1.5 flex-wrap pl-10">
              <ExecutiveStallIndicator lead={row.original} />
              {!isAllView && <PriorityBadge lead={row.original} />}
            </div>
          </div>
        ),
      }),
      // Same PhoneCell + backend visibility gate as the Admin Leads List (LeadDataTable.jsx) —
      // shown on every tab, not just "All Leads", to match Admin exactly.
      columnHelper.accessor('phone', {
        header: 'Phone',
        cell: ({ row }) => (
          <PhoneCell phone={row.original.phone} leadId={row.original._id} lead={row.original} />
        ),
      }),
      columnHelper.accessor('destination', {
        header: 'Destination',
        cell: (i) => <DestinationChip name={i.getValue()} />,
      }),
      // Same TravelDateCell as the Admin Leads List (LeadDataTable.jsx).
      columnHelper.accessor('travelDate', {
        header: 'Travel Date',
        cell: ({ getValue }) => <TravelDateCell date={getValue()} />,
      }),
      columnHelper.accessor((row) => row.mealPlan || row.mealPreference || 'map', {
        id: 'mealPlan',
        header: 'Meal Plan',
        cell: ({ row }) => (
          <MealPlanBadge mealPlan={row.original.mealPlan} mealPreference={row.original.mealPreference} />
        ),
      }),
      // Same field, same formatter, same masked-when-empty display as the Admin Leads List
      // (LeadDataTable.jsx's Budget column) — both read row.original.budget straight off the
      // lead document via BudgetBadge, no separate calculation.
      columnHelper.accessor('budget', {
        header: 'Budget',
        cell: ({ getValue }) => <BudgetBadge amount={getValue()} />,
      }),
      // Same TravelersBadge as the Admin Leads List (LeadDataTable.jsx).
      columnHelper.accessor('travelers', {
        header: 'Pax',
        cell: ({ row }) => (
          <TravelersBadge
            travelers={row.original.travelers}
            adults={row.original.adults}
            children={row.original.children}
          />
        ),
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
      columnHelper.accessor('nextFollowUp', {
        header: 'Next Follow-up',
        cell: (i) => (
          <span className="text-xs text-content-secondary whitespace-nowrap">{formatFollowUpDate(i.getValue())}</span>
        ),
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Link
              to={`/sales-manager/leads/${row.original._id}/view`}
              className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-subtle text-content-secondary hover:bg-surface-elevated"
              title="View lead"
            >
              <Eye className="w-4 h-4" />
            </Link>
            {reactivate.isLost(row.original) ? (
              <Button
                size="sm"
                variant="teal"
                className="h-8 px-2.5 text-[11px]"
                onClick={() => {
                  setReactivateLead(row.original);
                  reactivate.openReactivate();
                }}
              >
                <RefreshCw className="w-3 h-3 mr-0.5" /> Reactivate
              </Button>
            ) : row.original.assignmentAcceptance === 'expired' && !row.original.assignedTo ? (
              <Button
                size="sm"
                variant="gradient"
                className="h-8 px-2.5 text-[11px]"
                onClick={() => setAssignLead(row.original)}
              >
                <UserPlus className="w-3 h-3 mr-0.5" /> Reassign
              </Button>
            ) : (
              <Button size="sm" variant="gradient" className="h-8 px-2.5 text-[11px]" onClick={() => setAssignLead(row.original)}>
                <UserPlus className="w-3 h-3 mr-0.5" /> {row.original.assignedTo ? 'Reassign' : 'Assign'}
              </Button>
            )}
          </div>
        ),
      })
    );

    return base;
  }, [isAllView, reactivate, selectedIds, setReactivateLead, setAssignLead]);

  return (
    <div className="space-y-6">
      <PageHeader title={meta.title} description={meta.desc} breadcrumbs={['Sales Manager', 'Leads', meta.title]} />

      {isLostView && <ReactivationFlowSteps />}

      {isAllView ? (
        <>
          <div className="flex flex-col xl:flex-row gap-4 items-stretch">
            <ManagerLeadKpiStrip filters={allLeadsFilters} />
            <ManagerPipelineCard />
          </div>

          <LeadFilterBar
            filters={filters}
            onChange={setFilters}
            onApply={handleApply}
            onReset={handleReset}
            onPeriodSelect={handlePeriodSelect}
            onQuickFilter={handleQuickFilter}
            activeCount={countActiveFilters(appliedFilters)}
          />
        </>
      ) : (
        <>
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

          <div className="relative max-w-md space-y-3">
            <PeriodPresetChips dateFrom={dateFrom} dateTo={dateTo} onSelect={setPeriod} />
            <input
              value={bucketSearch}
              onChange={(e) => setBucketSearch(e.target.value)}
              placeholder="Search leads…"
              className="w-full px-4 py-2.5 rounded-xl border border-violet-500/20 bg-surface/80 backdrop-blur-xl text-sm outline-none focus:ring-2 focus:ring-violet-500/40 shadow-sm"
            />
          </div>
        </>
      )}

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
