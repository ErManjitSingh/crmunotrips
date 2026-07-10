import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Sparkles, Phone, CalendarClock, Flame, Trophy, XCircle, TrendingUp, RefreshCw, Users } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { createColumnHelper } from '@tanstack/react-table';
import API from '../../api/axios';
import { isLeadStatusLocked } from '../../utils/leadUtils';
import { useRoleLeadsQuery } from '../../hooks/useRoleLeadsQuery';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import ExecutivePageShell from './ExecutivePageShell';
import { Button } from '../ui/button';
import {
  executiveCardHover,
  executiveInput,
  executiveBanner,
  executiveIconAccent,
} from './executivePageStyles';
import PriorityBadge from '../sales-manager/PriorityBadge';
import ExecutiveLeadKpiStrip from './ExecutiveLeadKpiStrip';
import ExecutivePipelineCard from './ExecutivePipelineCard';
import ExecutiveLeadsFilterBar from './ExecutiveLeadsFilterBar';
import {
  LeadIdPill,
  DestinationChip,
  BudgetBadge,
  ManagerStatusBadge,
  CustomerCell,
  TravelDateCell,
} from '../sales-manager/LeadListBadges';
import { LEAD_FILTERS, EXEC_FILTER_THEMES, formatFollowUpDate } from './executiveUtils';
import LeadActionsMenu, { ActionModal } from './LeadActionsMenu';
import VirtualizedRoleTable from '../ui/VirtualizedRoleTable';
import AddFollowUpModal from '../followups/AddFollowUpModal';
import { createExecutiveFollowUp, buildFollowUpPayload } from '../followups/followupApi';

const ICONS = { Sparkles, Phone, CalendarClock, Flame, Trophy, XCircle, RefreshCw, Users };

const STATUSES = [
  'new',
  'contacted',
  'working_progress',
  'follow_up',
  'quotation_sent',
  'negotiation',
  'converted',
  'lost',
  'booked_from_another_company',
];

const columnHelper = createColumnHelper();

export default function MyLeadsPage() {
  const queryClient = useQueryClient();
  const { filter = 'new' } = useParams();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 500);
  const [statusFilter, setStatusFilter] = useState('');
  const [destinationFilter, setDestinationFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 25 });
  const [modal, setModal] = useState(null);
  const [modalStatus, setModalStatus] = useState('contacted');
  const [modalStatusReason, setModalStatusReason] = useState('');

  const meta = LEAD_FILTERS[filter] || LEAD_FILTERS.new;
  const theme = EXEC_FILTER_THEMES[filter] || EXEC_FILTER_THEMES.new;
  const Icon = ICONS[meta.icon] || Sparkles;

  const isAllView = filter === 'all';

  const { data, isLoading } = useRoleLeadsQuery({
    endpoint: '/sales-executive/leads',
    filter,
    search: debouncedSearch,
    skipDebounce: true,
    status: isAllView ? statusFilter : '',
    destination: isAllView ? destinationFilter : '',
    priority: isAllView ? priorityFilter : '',
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
  });

  const leads = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pagination.pageSize) || 1);

  const fetchLeads = () => queryClient.invalidateQueries({ queryKey: ['leads', '/sales-executive/leads'] });

  useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }, [filter, debouncedSearch, statusFilter, destinationFilter, priorityFilter]);

  useEffect(() => {
    if (!isAllView) {
      setStatusFilter('');
      setDestinationFilter('');
      setPriorityFilter('');
    }
  }, [isAllView]);

  const handleChangeStatus = async () => {
    if (!modal?.lead) return;
    await API.put(`/sales-executive/leads/${modal.lead._id}`, {
      status: modalStatus,
      statusReason: modalStatusReason,
    });
    setModal(null);
    setModalStatusReason('');
    fetchLeads();
  };
  const reasonRequired = ['lost', 'booked_from_another_company'].includes(modalStatus);

  const columns = useMemo(() => [
    columnHelper.accessor('leadId', {
      header: 'Lead ID',
      cell: (i) => <LeadIdPill id={i.getValue()} />,
    }),
    columnHelper.accessor('name', {
      header: 'Customer Name',
      cell: ({ row }) => (
        <div className="space-y-1.5">
          <Link
            to={`/sales-executive/leads/${row.original._id}/view`}
            className="block rounded-lg -m-1 p-1 hover:bg-sky-500/5 transition-colors"
          >
            <CustomerCell name={row.original.name} lead={row.original} />
          </Link>
          {row.original.isHot && <PriorityBadge lead={row.original} />}
        </div>
      ),
    }),
    columnHelper.accessor('phone', {
      header: 'Phone',
      cell: (i) => <span className="text-xs text-content-secondary font-mono">{i.getValue()}</span>,
    }),
    columnHelper.accessor('destination', {
      header: 'Destination',
      cell: (i) => <DestinationChip name={i.getValue()} />,
    }),
    columnHelper.accessor('travelDate', {
      header: 'Travel Date',
      cell: (i) => <TravelDateCell date={i.getValue()} />,
    }),
    columnHelper.accessor('budget', {
      header: 'Budget',
      cell: (i) => <BudgetBadge amount={i.getValue()} />,
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: ({ row }) => <ManagerStatusBadge status={row.original.status} lead={row.original} />,
    }),
    columnHelper.accessor('priority', {
      header: 'Priority',
      cell: ({ row }) => <PriorityBadge lead={row.original} />,
    }),
    columnHelper.accessor('nextFollowUp', {
      header: 'Next Follow-up',
      cell: (i) => <span className="text-xs text-content-secondary">{formatFollowUpDate(i.getValue())}</span>,
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <LeadActionsMenu
          lead={row.original}
          canChangeStatus={!isLeadStatusLocked(row.original.status)}
          onScheduleFollowUp={(lead) => { setModal({ type: 'followup', lead }); }}
          onChangeStatus={(lead) => {
            setModal({ type: 'status', lead });
            setModalStatus(lead.status);
            setModalStatusReason(lead.statusReason || '');
          }}
        />
      ),
    }),
  ], []);

  return (
    <ExecutivePageShell title={meta.title} description={meta.desc} icon={Icon} showDate={false}>
      {isAllView ? (
        <>
          <div className="flex flex-col xl:flex-row gap-4 items-stretch">
            <ExecutiveLeadKpiStrip />
            <ExecutivePipelineCard />
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
          />
        </>
      ) : (
        <>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`${executiveBanner} backdrop-blur-xl`}
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-2xl bg-white/80 dark:bg-slate-900/60 shadow-sm ${theme.icon}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-content-primary tabular-nums">{isLoading ? '—' : total}</p>
                  <p className="text-sm text-content-secondary">{meta.title}</p>
                </div>
              </div>
              {filter === 'hot' && (
                <div className="text-xs text-content-secondary max-w-sm">
                  Auto-highlighted: budget &gt; ₹50K · travel within 30 days · repeat customers
                </div>
              )}
              <div className="flex items-center gap-2 text-sm font-semibold text-[#5D5FEF] bg-[#5D5FEF]/10 px-3 py-1.5 rounded-full ring-1 ring-[#5D5FEF]/20">
                <TrendingUp className="w-4 h-4" /> Your pipeline
              </div>
            </div>
          </motion.div>

          <div className="flex flex-col gap-3 max-w-md">
            <div className="relative flex-1 max-w-md">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${executiveIconAccent}`} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, destination, phone…"
                className={`w-full pl-10 pr-4 py-2.5 ${executiveInput}`}
              />
            </div>
          </div>
        </>
      )}

      <VirtualizedRoleTable
        data={leads}
        columns={columns}
        isLoading={isLoading}
        pagination={pagination}
        pageCount={pageCount}
        total={total}
        onPaginationChange={setPagination}
        rowClassName={executiveCardHover}
      />

      <ActionModal open={modal?.type === 'status'} title="Change Status" onClose={() => setModal(null)}>
        <select
          value={modalStatus}
          onChange={(e) => setModalStatus(e.target.value)}
          className="w-full rounded-xl border border-subtle bg-surface-elevated p-3 text-sm mb-4"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <textarea
          value={modalStatusReason}
          onChange={(e) => setModalStatusReason(e.target.value)}
          rows={3}
          placeholder="Reason for status change"
          className="w-full rounded-xl border border-subtle bg-white dark:bg-slate-900 p-3 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
        />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => { setModal(null); setModalStatusReason(''); }}>Cancel</Button>
          <Button onClick={handleChangeStatus} disabled={reasonRequired && !modalStatusReason.trim()}>Update</Button>
        </div>
      </ActionModal>

      <AddFollowUpModal
        open={modal?.type === 'followup'}
        onClose={() => setModal(null)}
        fixedLeadId={modal?.lead?._id}
        fixedLeadName={modal?.lead?.name}
        onSubmit={async (data) => {
          await createExecutiveFollowUp(buildFollowUpPayload({ ...data, lead: modal.lead._id }));
          setModal(null);
          fetchLeads();
        }}
      />
    </ExecutivePageShell>
  );
}
