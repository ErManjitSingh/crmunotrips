import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Sparkles, Phone, CalendarClock, Flame, Trophy, XCircle, RefreshCw, Users, Plus, ChevronDown, AlertTriangle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { createColumnHelper } from '@tanstack/react-table';
import API from '../../api/axios';
import { isLeadStatusLocked } from '../../utils/leadUtils';
import { useRoleLeadsQuery } from '../../hooks/useRoleLeadsQuery';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import ExecutivePageShell from './ExecutivePageShell';
import { Button } from '../ui/button';
import ExecutiveLeadKpiStrip from './ExecutiveLeadKpiStrip';
import ExecutiveLeadsFilterBar from './ExecutiveLeadsFilterBar';
import ExecutivePipelineCta from './ExecutivePipelineCta';
import {
  ExecLeadIdCell,
  ExecCustomerCell,
  ExecContactCell,
  ExecDestinationCell,
  ExecDateCell,
  ExecBudgetCell,
  ExecStatusCell,
  ExecPriorityCell,
  ExecFollowUpCell,
} from './ExecutiveLeadListCells';
import { LEAD_FILTERS } from './executiveUtils';
import LeadActionsMenu, { ActionModal } from './LeadActionsMenu';
import LeadListAcceptButton from '../leads/LeadListAcceptButton';
import { invalidateLeadLists } from '../../lib/queryInvalidation';
import VirtualizedRoleTable from '../ui/VirtualizedRoleTable';
import AddFollowUpModal from '../followups/AddFollowUpModal';
import { createExecutiveFollowUp, buildFollowUpPayload } from '../followups/followupApi';
import ConvertedLeadsTable from '../leads/ConvertedLeadsTable';
import LostReasonSelect from '../leads/LostReasonSelect';
import PostConvertCommercialModal from '../leads/PostConvertCommercialModal';

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
  const navigate = useNavigate();
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
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [commercialLeadId, setCommercialLeadId] = useState(null);
  const meta = LEAD_FILTERS[filter] || LEAD_FILTERS.new;
  const Icon = ICONS[meta.icon] || Sparkles;

  const isAllView = filter === 'all';
  const isConvertedView = filter === 'converted';

  const { data, isLoading } = useRoleLeadsQuery({
    endpoint: '/sales-executive/leads',
    filter,
    search: debouncedSearch,
    skipDebounce: true,
    status: isAllView ? statusFilter : '',
    destination: destinationFilter,
    priority: priorityFilter,
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
  });

  const leads = data?.data ?? [];
  const total = data?.pagination?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pagination.pageSize) || 1);
  const returnedLeads = leads.filter((l) => l.returnedToPool || l.contactMasked);

  const fetchLeads = () => {
    queryClient.invalidateQueries({ queryKey: ['leads', '/sales-executive/leads'] });
    queryClient.invalidateQueries({ queryKey: ['nav-counts'] });
  };

  useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }, [filter, debouncedSearch, statusFilter, destinationFilter, priorityFilter]);

  useEffect(() => {
    setStatusFilter('');
    setDestinationFilter('');
    setPriorityFilter('');
  }, [filter]);

  const handleChangeStatus = async () => {
    if (!modal?.lead) return;
    const payload = {
      status: modalStatus,
      statusReason: modalStatusReason,
    };
    if (modalStatus === 'converted') {
      const advance = Number(advanceAmount);
      if (!Number.isFinite(advance) || advance < 0) return;
      payload.advanceAmount = advance;
      payload.paymentMethod = paymentMethod;
      payload.sendReceipt = true;
    }
    await API.put(`/sales-executive/leads/${modal.lead._id}`, payload);
    const becameConverted = modalStatus === 'converted';
    const convertedId = modal.lead._id;
    setModal(null);
    setModalStatusReason('');
    setAdvanceAmount('');
    fetchLeads();
    if (becameConverted) setCommercialLeadId(convertedId);
  };
  const reasonRequired = ['lost', 'booked_from_another_company'].includes(modalStatus);
  const convertAdvanceInvalid =
    modalStatus === 'converted' && (!advanceAmount || Number(advanceAmount) < 0 || Number.isNaN(Number(advanceAmount)));

  const columns = useMemo(() => [
    columnHelper.accessor('leadId', {
      header: 'Lead ID',
      cell: ({ row }) => <ExecLeadIdCell lead={row.original} />,
    }),
    columnHelper.accessor('name', {
      header: 'Customer',
      cell: ({ row }) => <ExecCustomerCell lead={row.original} />,
    }),
    columnHelper.display({
      id: 'contact',
      header: 'Contact',
      cell: ({ row }) => <ExecContactCell lead={row.original} />,
    }),
    columnHelper.accessor('destination', {
      header: 'Destination',
      cell: (i) => <ExecDestinationCell name={i.getValue()} />,
    }),
    columnHelper.accessor('travelDate', {
      header: 'Travel Date',
      cell: (i) => <ExecDateCell date={i.getValue()} />,
    }),
    columnHelper.accessor('budget', {
      header: 'Budget',
      cell: (i) => <ExecBudgetCell amount={i.getValue()} />,
    }),
    columnHelper.accessor('status', {
      header: 'Status',
      cell: ({ row }) => <ExecStatusCell lead={row.original} />,
    }),
    columnHelper.accessor('priority', {
      header: 'Intent',
      cell: ({ row }) => <ExecPriorityCell lead={row.original} />,
    }),
    columnHelper.accessor('nextFollowUp', {
      header: 'Next Follow-up',
      cell: (i) => <ExecFollowUpCell date={i.getValue()} />,
    }),
    columnHelper.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const returned = row.original.returnedToPool || row.original.contactMasked;
        if (returned) {
          return (
            <div className="flex justify-end pr-1">
              <span className="inline-flex h-8 items-center rounded-xl bg-amber-50 px-2.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 ring-1 ring-amber-200">
                Returned
              </span>
            </div>
          );
        }
        return (
        <div className="flex items-center justify-end gap-0 pr-1">
          {row.original.assignmentAcceptance === 'pending' ? (
            <div className="inline-flex items-stretch rounded-xl ring-1 ring-emerald-500/25 shadow-sm shadow-emerald-500/10 overflow-hidden">
              <LeadListAcceptButton
                lead={row.original}
                className="!rounded-none"
                onAccepted={() => {
                  invalidateLeadLists(queryClient);
                  fetchLeads();
                }}
                onExpired={() => {
                  invalidateLeadLists(queryClient);
                  fetchLeads();
                }}
              />
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
            </div>
          ) : (
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
          )}
        </div>
        );
      },
    }),
  ], [queryClient]);

  return (
    <ExecutivePageShell
      title={meta.title}
      description={meta.desc}
      icon={Icon}
      showDate={false}
      action={(
        <Link
          to="/sales-executive/leads/add"
          className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-[#5D5FEF] hover:bg-[#4F51E0] text-white text-sm font-semibold shadow-md shadow-[#5D5FEF]/25 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Lead
          <ChevronDown className="w-3.5 h-3.5 opacity-80" />
        </Link>
      )}
    >
      <ExecutiveLeadKpiStrip />

      {returnedLeads.length > 0 && (
        <div className="mb-3 flex flex-wrap items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="min-w-0">
            <p className="text-sm font-bold">
              {returnedLeads.length === 1
                ? '1 lead was returned to the pool'
                : `${returnedLeads.length} leads were returned to the pool`}
            </p>
            <p className="mt-0.5 text-xs font-medium opacity-90">
              These leads were assigned to you but not accepted within 2 minutes. They stay on this list with phone shown as{' '}
              <span className="font-bold tracking-widest">XXXX</span>.
            </p>
          </div>
        </div>
      )}

      <ExecutiveLeadsFilterBar
        search={search}
        onSearchChange={setSearch}
        statusFilter={isAllView ? statusFilter : ''}
        onStatusChange={setStatusFilter}
        destinationFilter={destinationFilter}
        onDestinationChange={setDestinationFilter}
        priorityFilter={priorityFilter}
        onPriorityChange={setPriorityFilter}
        showStatusFilter={isAllView}
        showAddLead={false}
      />

      {isConvertedView ? (
        isLoading ? (
          <div className="rounded-2xl border border-subtle bg-white p-16 text-center text-content-muted">
            Loading converted bookings…
          </div>
        ) : (
          <ConvertedLeadsTable
            leads={leads}
            detailBasePath="/sales-executive/leads"
            onRowClick={(lead) => navigate(`/sales-executive/leads/${lead._id}/view`)}
            serverPagination={{
              pageIndex: pagination.pageIndex,
              pageSize: pagination.pageSize,
              pageCount,
              total,
              onPaginationChange: setPagination,
            }}
          />
        )
      ) : (
        <VirtualizedRoleTable
          data={leads}
          columns={columns}
          isLoading={isLoading}
          pagination={pagination}
          pageCount={pageCount}
          total={total}
          onPaginationChange={setPagination}
          estimateRowHeight={72}
          maxHeight="min(72vh, 720px)"
          getRowClassName={(lead) => (lead?.isHot ? 'bg-orange-50' : undefined)}
        />
      )}

      <ExecutivePipelineCta />

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
        {modalStatus === 'converted' && (
          <div className="mb-4 space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/80 p-3">
            <p className="text-xs font-semibold text-emerald-800">
              Enter advance / token received. Customer will get a payment voucher by email.
            </p>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Advance / Token (₹)</label>
              <input
                type="number"
                min={0}
                value={advanceAmount}
                onChange={(e) => setAdvanceAmount(e.target.value)}
                placeholder="e.g. 15000"
                className="mt-1 w-full rounded-xl border border-subtle bg-white p-3 text-sm"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Payment mode</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="mt-1 w-full rounded-xl border border-subtle bg-white p-3 text-sm"
              >
                <option value="upi">UPI</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
          </div>
        )}
        {['lost', 'booked_from_another_company'].includes(modalStatus) ? (
          <LostReasonSelect
            value={modalStatusReason}
            onChange={setModalStatusReason}
            className="mb-4"
          />
        ) : (
          <textarea
            value={modalStatusReason}
            onChange={(e) => setModalStatusReason(e.target.value)}
            rows={3}
            placeholder="Reason for status change (optional)"
            className="w-full rounded-xl border border-subtle bg-white dark:bg-slate-900 p-3 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-violet-500/30"
          />
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => { setModal(null); setModalStatusReason(''); setAdvanceAmount(''); }}>Cancel</Button>
          <Button
            onClick={handleChangeStatus}
            disabled={(reasonRequired && !modalStatusReason.trim()) || convertAdvanceInvalid}
          >
            {modalStatus === 'converted' ? 'Convert & Send Voucher' : 'Update'}
          </Button>
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

      <PostConvertCommercialModal
        open={Boolean(commercialLeadId)}
        leadId={commercialLeadId}
        onClose={() => setCommercialLeadId(null)}
        onSaved={() => fetchLeads()}
      />
    </ExecutivePageShell>
  );
}
