import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { Search, Users, MoreHorizontal, Eye, MessageSquare, AlertTriangle, UserPlus, RefreshCw, XCircle, Flame, Undo2 } from 'lucide-react';
import { createColumnHelper } from '@tanstack/react-table';
import API from '../../api/axios';
import { useRoleLeadsQuery } from '../../hooks/useRoleLeadsQuery';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import PageHeader from '../ui/PageHeader';
import { DEFAULT_PAGE_SIZE } from '../ui/TablePagination';
import VirtualizedRoleTable from '../ui/VirtualizedRoleTable';
import { Button } from '../ui/button';
import PriorityBadge from '../sales-manager/PriorityBadge';
import {
  DestinationChip, BudgetBadge, ExecutiveBadge, ManagerStatusBadge, CustomerCell, FILTER_THEMES,
} from '../sales-manager/LeadListBadges';
import { ExecutiveStallIndicator, executiveStallRowClass } from '../sales-manager/ExecutiveStallIndicator';
import ManagerLeadKpiStrip from '../sales-manager/ManagerLeadKpiStrip';
import ManagerPipelineCard from '../sales-manager/ManagerPipelineCard';
import ExecutiveLeadsFilterBar from '../sales-executive/ExecutiveLeadsFilterBar';
import {
  ReactivationHeroBanner, ReactivationFlowSteps, ReactivationEmptyState,
} from '../leads/ReactivationPanelUi';
import { formatFollowUpDate } from './leaderUtils';
import { toast } from '../../context/ToastContext';
import { useLeadAssign } from '../../hooks/useLeadAssign';
import AdminAssignLeadModal from '../leads/AdminAssignLeadModal';
import ReactivationActionsModal from '../lead-detail/ReactivationActionsModal';
import { useLeadReactivate } from '../../hooks/useLeadReactivate';
import { useMyTeamQuery } from '../../hooks/useMyTeamQuery';
import MyTeamPanel from './MyTeamPanel';
import { TooltipProvider } from '../ui/tooltip';
import {
  DropdownMenuRoot, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '../ui/dropdown-menu';

const columnHelper = createColumnHelper();

import AppModal from '../ui/AppModal';

export function ActionModal({ open, title, onClose, children }) {
  return (
    <AppModal open={open} onClose={onClose} size="md" className="p-6">
      <h3 className="text-lg font-bold text-content-primary mb-4">{title}</h3>
      {children}
    </AppModal>
  );
}

const FILTER_META = {
  all: { title: 'Team Leads', desc: 'Leads assigned to your squad — coach and convert', icon: Users },
  returned: {
    title: 'Returned Leads',
    desc: 'Leads your executives did not accept in time — back in the pool',
    icon: Undo2,
  },
  lost: { title: 'Lost Leads', desc: 'Closed-lost opportunities from your team', icon: XCircle },
  reactivated: { title: 'Reactivated Leads', desc: 'Leads brought back into the pipeline', icon: RefreshCw },
  hot: { title: 'Hot Leads', desc: 'High-value or urgent squad leads', icon: Flame },
};

export default function LeaderTeamLeadsPage() {
  const queryClient = useQueryClient();
  const { filter: routeFilter } = useParams();
  const filter = routeFilter && FILTER_META[routeFilter] ? routeFilter : 'all';
  const meta = FILTER_META[filter] || FILTER_META.all;
  const MetaIcon = meta.icon;
  const theme = FILTER_THEMES[filter] || FILTER_THEMES.all;
  const showRecoveryUi = filter === 'lost' || filter === 'reactivated';
  const isAllView = filter === 'all';
  const { data: myTeam = { team: null, members: [], message: null }, isLoading: teamLoading } = useMyTeamQuery();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [destinationFilter, setDestinationFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [reactivateLeadRow, setReactivateLeadRow] = useState(null);
  const debouncedSearch = useDebouncedValue(search, 350);
  const [modal, setModal] = useState(null);
  const [text, setText] = useState('');
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE });

  const { data, isLoading } = useRoleLeadsQuery({
    endpoint: '/team-leader/leads',
    filter,
    search: debouncedSearch,
    status: isAllView ? statusFilter : '',
    destination: isAllView ? destinationFilter : '',
    priority: isAllView ? priorityFilter : '',
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
  });

  const leads = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pagination.pageSize) || 1);

  const fetchLeads = () => queryClient.invalidateQueries({ queryKey: ['leads', '/team-leader/leads'] });

  const refreshAfterAssign = useCallback(() => {
    fetchLeads();
  }, [queryClient]);

  const {
    assignees,
    assigneesLoading,
    assignModal,
    openAssign,
    closeAssign,
    handleAssign,
    assignConfirmDialog,
  } = useLeadAssign({ onAssigned: refreshAfterAssign });

  const reactivate = useLeadReactivate({
    leadId: reactivateLeadRow?._id,
    onSuccess: () => {
      setReactivateLeadRow(null);
      refreshAfterAssign();
    },
  });

  useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }, [debouncedSearch, filter, statusFilter, destinationFilter, priorityFilter]);

  const handleComment = async () => {
    if (!modal?.lead || !text.trim()) return;
    await API.post(`/team-leader/leads/${modal.lead._id}/comment`, { text });
    setModal(null);
    setText('');
    fetchLeads();
  };

  const handleEscalate = async (lead) => {
    await API.post('/team-leader/escalations', { _id: lead._id, leadName: lead.name, type: 'stuck' });
    toast.success(`${lead.name} escalated to Sales Manager`);
  };

  const reactivationExecs = assignees?.salesExecutives || [];

  const columns = useMemo(() => [
    columnHelper.accessor('name', {
      header: 'Customer',
      cell: ({ row }) => (
        <div className="space-y-1.5">
          <CustomerCell name={row.original.name} lead={row.original} showPhone={isAllView} />
          <div className="flex items-center gap-1.5 flex-wrap pl-10">
            <ExecutiveStallIndicator lead={row.original} />
            {row.original.isHot && <PriorityBadge lead={row.original} />}
          </div>
        </div>
      ),
    }),
    columnHelper.accessor('destination', { header: 'Destination', cell: (i) => <DestinationChip name={i.getValue()} /> }),
    columnHelper.accessor('assignedTo', { header: 'Executive', cell: (i) => <ExecutiveBadge name={i.getValue()?.name} /> }),
    columnHelper.accessor('budget', { header: 'Budget', cell: (i) => <BudgetBadge amount={i.getValue()} /> }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: ({ row }) => <ManagerStatusBadge status={row.original.status} lead={row.original} />,
    }),
    columnHelper.accessor('nextFollowUp', { header: 'Next Follow-up', cell: (i) => <span className="text-xs text-content-secondary whitespace-nowrap">{formatFollowUpDate(i.getValue())}</span> }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          {reactivate.isLost(row.original) && (
            <Button
              size="sm"
              variant="teal"
              className="h-7 px-2 text-[11px]"
              onClick={() => {
                setReactivateLeadRow(row.original);
                reactivate.openReactivate();
              }}
            >
              <RefreshCw className="w-3 h-3 mr-0.5" /> Reactivate
            </Button>
          )}
          {row.original.assignmentAcceptance === 'expired' && !row.original.assignedTo && (
            <div className="inline-flex items-stretch rounded-xl overflow-hidden ring-1 ring-amber-500/30 shadow-sm">
              <span className="inline-flex h-8 items-center px-2 text-[10px] font-bold uppercase tracking-wide text-amber-800 bg-amber-50">
                Not accepted
              </span>
              <Button
                size="sm"
                variant="gradient"
                className="h-8 rounded-none px-2.5 text-[11px]"
                onClick={() => openAssign(row.original)}
              >
                <UserPlus className="w-3 h-3 mr-0.5" /> Reassign
              </Button>
            </div>
          )}
        <DropdownMenuRoot>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><MoreHorizontal className="w-4 h-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem asChild>
              <Link to={`/team-leader/leads/${row.original._id}/view`} className="flex items-center gap-2 cursor-pointer">
                <Eye className="w-4 h-4" /> View Lead
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => { setModal({ type: 'comment', lead: row.original }); setText(''); }} className="flex items-center gap-2 cursor-pointer">
              <MessageSquare className="w-4 h-4" /> Add Comment
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleEscalate(row.original)} className="flex items-center gap-2 cursor-pointer">
              <AlertTriangle className="w-4 h-4" /> Escalate Lead
            </DropdownMenuItem>
            {reactivate.isLost(row.original) ? (
              <DropdownMenuItem
                onClick={() => {
                  setReactivateLeadRow(row.original);
                  reactivate.openReactivate();
                }}
                className="flex items-center gap-2 cursor-pointer text-teal-700"
              >
                <RefreshCw className="w-4 h-4" /> Reactivate Lead
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => openAssign(row.original)} className="flex items-center gap-2 cursor-pointer">
                <UserPlus className="w-4 h-4" />
                {row.original.assignmentAcceptance === 'expired' ? 'Reassign Lead' : 'Assign to Executive'}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenuRoot>
        </div>
      ),
    }),
  ], [reactivate, openAssign, setReactivateLeadRow, setModal, setText, isAllView]);

  return (
    <div className="space-y-6">
      <PageHeader title={meta.title} description={meta.desc} breadcrumbs={['Team Leader', 'Leads', meta.title]} />

      {filter === 'all' && (
        <>
          <MyTeamPanel
            team={myTeam.team}
            members={myTeam.members}
            message={myTeam.message}
            loading={teamLoading}
          />
          <div className="flex flex-col xl:flex-row gap-4 items-stretch">
            <ManagerLeadKpiStrip />
            <ManagerPipelineCard dashboardPath="/team-leader/dashboard" />
          </div>
          <ExecutiveLeadsFilterBar
            search={search}
            onSearchChange={setSearch}
            statusFilter={statusFilter}
            onStatusChange={setStatusFilter}
            destinationFilter={destinationFilter}
            onDestinationChange={setDestinationFilter}
            priorityFilter={priorityFilter}
            onPriorityChange={setPriorityFilter}
            showAddLead={false}
          />
        </>
      )}

      {filter === 'all' ? null : (
        <MyTeamPanel
          team={myTeam.team}
          members={myTeam.members}
          message={myTeam.message}
          loading={teamLoading}
        />
      )}

      {showRecoveryUi && <ReactivationFlowSteps />}

      {showRecoveryUi ? (
        <ReactivationHeroBanner
          title={meta.title}
          subtitle={meta.desc}
          total={total}
          loading={isLoading}
          theme={filter}
          icon={MetaIcon}
        />
      ) : !isAllView ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`relative overflow-hidden rounded-2xl border ${theme.border} bg-gradient-to-r ${theme.gradient} p-5`}
        >
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl bg-surface/80 ${theme.icon}`}><MetaIcon className="w-6 h-6" /></div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{isLoading ? '—' : total}</p>
              <p className="text-sm text-content-secondary">{meta.title}</p>
            </div>
          </div>
        </motion.div>
      ) : null}

      {!isAllView && (
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer, destination, executive…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-subtle bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30"
          />
        </div>
      )}
      <TooltipProvider delayDuration={0}>
        <VirtualizedRoleTable
          data={leads}
          columns={columns}
          isLoading={isLoading}
          pagination={pagination}
          pageCount={pageCount}
          total={total}
          onPaginationChange={setPagination}
          emptyMessage={filter === 'lost' ? 'No lost leads' : 'No leads in this view'}
          getRowClassName={executiveStallRowClass}
        />
      </TooltipProvider>

      <ActionModal open={modal?.type === 'comment'} title="Add Comment" onClose={() => setModal(null)}>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder="Team leader note…" className="w-full rounded-xl border border-subtle bg-surface-elevated p-3 text-sm mb-4" />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button>
          <Button onClick={handleComment}>Save</Button>
        </div>
      </ActionModal>

      <AdminAssignLeadModal
        open={!!assignModal}
        lead={assignModal}
        assignees={assignees}
        loading={assigneesLoading}
        onClose={closeAssign}
        onAssign={handleAssign}
        allowedRoles={['sales_executive']}
      />
      <ReactivationActionsModal
        open={!!reactivateLeadRow && reactivate.mode === 'reactivate'}
        mode="reactivate"
        lead={reactivateLeadRow}
        executives={reactivationExecs}
        executivesLoading={assigneesLoading}
        onClose={() => {
          reactivate.close();
          setReactivateLeadRow(null);
        }}
        onSubmit={reactivate.submit}
      />
      {assignConfirmDialog}
    </div>
  );
}
