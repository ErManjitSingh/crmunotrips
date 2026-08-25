import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Sparkles, Phone, CalendarClock, Flame, Trophy, XCircle, RefreshCw, Users, Plus, ChevronDown, Undo2, Loader, Copy } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { createColumnHelper } from '@tanstack/react-table';
import API from '../../api/axios';
import { toast } from '../../context/ToastContext';
import { isLeadStatusLocked } from '../../utils/leadUtils';
import { useRoleLeadsQuery } from '../../hooks/useRoleLeadsQuery';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import ExecutivePageShell from './ExecutivePageShell';
import ExecutiveLeadKpiStrip from './ExecutiveLeadKpiStrip';
import ExecutiveLeadsFilterBar from './ExecutiveLeadsFilterBar';
import MobileExecutiveLeads from './MobileExecutiveLeads';
import ExecutivePipelineCta from './ExecutivePipelineCta';
import {
  ExecLeadIdCell,
  ExecCustomerCell,
  ExecContactCell,
  ExecDestinationCell,
  ExecDateCell,
  ExecMealPlanCell,
  ExecStatusCell,
  ExecPriorityCell,
  ExecFollowUpCell,
} from './ExecutiveLeadListCells';
import { LEAD_FILTERS } from './executiveUtils';
import LeadActionsMenu from './LeadActionsMenu';
import { invalidateLeadLists } from '../../lib/queryInvalidation';
import VirtualizedRoleTable from '../ui/VirtualizedRoleTable';
import AddFollowUpModal from '../followups/AddFollowUpModal';
import { createExecutiveFollowUp, buildFollowUpPayload } from '../followups/followupApi';
import ConvertedLeadsTable from '../leads/ConvertedLeadsTable';
import PostConvertCommercialModal from '../leads/PostConvertCommercialModal';
import LeadFollowUpOutcomeModal from './LeadFollowUpOutcomeModal';
import { getFollowUpOutcome } from '../../constants/leadFollowUpOutcomes';
import { useSidebarCounts } from '../../hooks/useSidebarCounts';
import { resolveListTotal } from '../../lib/resolveListTotal';
import { useUrlPeriodFilter } from '../../hooks/useUrlPeriodFilter';

const ICONS = { Sparkles, Phone, CalendarClock, Flame, Trophy, XCircle, RefreshCw, Users, Undo2, Loader, Copy };

const columnHelper = createColumnHelper();

export default function MyLeadsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { filter = 'new' } = useParams();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 500);
  const [statusFilter, setStatusFilter] = useState('');
  const [destinationFilter, setDestinationFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 25 });
  const [modal, setModal] = useState(null);
  const [commercialLeadId, setCommercialLeadId] = useState(null);
  const { dateFrom, dateTo, setPeriod } = useUrlPeriodFilter();
  const meta = LEAD_FILTERS[filter] || LEAD_FILTERS.new;
  const Icon = ICONS[meta.icon] || Sparkles;

  const isAllView = filter === 'all';
  const isConvertedView = filter === 'converted';

  const outcomeMeta = statusFilter ? getFollowUpOutcome(statusFilter) : null;
  const outcomeReasonKey = outcomeMeta?.lostReason || outcomeMeta?.value || '';

  const { data, isLoading } = useRoleLeadsQuery({
    endpoint: '/sales-executive/leads',
    filter,
    search: debouncedSearch,
    skipDebounce: true,
    status: isAllView && outcomeMeta ? outcomeMeta.status : '',
    statusReason:
      isAllView && outcomeReasonKey && !['converted', 'working_progress'].includes(statusFilter)
        ? outcomeReasonKey
        : '',
    destination: destinationFilter,
    state: stateFilter,
    priority: priorityFilter,
    dateFrom,
    dateTo,
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
  });

  const navCounts = useSidebarCounts();
  const leads = data?.data ?? [];
  const hasMore = data?.hasMore ?? false;
  const hasListScope = Boolean(dateFrom || dateTo);
  const total = resolveListTotal({
    apiTotal: data?.pagination?.total,
    rowCount: leads.length,
    pageIndex: pagination.pageIndex,
    pageSize: pagination.pageSize,
    hasMore,
    fallbackTotal: hasListScope
      ? undefined
      : isAllView
        ? navCounts?.leads?.all
        : navCounts?.leads?.[
            filter === 'follow-up'
              ? 'followUp'
              : filter === 'working-progress'
                ? 'workingProgress'
                : filter === 'duplicates' || filter === 'repeated'
                  ? 'repeated'
                  : filter
          ],
  }) ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pagination.pageSize) || 1);

  const fetchLeads = () => {
    queryClient.invalidateQueries({ queryKey: ['leads', '/sales-executive/leads'] });
    queryClient.invalidateQueries({ queryKey: ['nav-counts'] });
  };

  useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }, [filter, debouncedSearch, statusFilter, destinationFilter, stateFilter, priorityFilter, dateFrom, dateTo]);

  useEffect(() => {
    setStatusFilter('');
    setDestinationFilter('');
    setStateFilter('');
    setPriorityFilter('');
    setSourceFilter('');
  }, [filter]);

  const handleFollowUpOutcome = async (payload, meta = {}) => {
    if (!modal?.lead) return;
    await API.put(`/sales-executive/leads/${modal.lead._id}`, payload);
    if (meta.comment && ['lost', 'booked_from_another_company'].includes(payload.status)) {
      await API.post(`/sales-executive/leads/${modal.lead._id}/notes`, {
        text: meta.comment,
      }).catch(() => {});
    }
    const becameConverted = payload.status === 'converted';
    const convertedId = modal.lead._id;
    setModal(null);
    fetchLeads();
    if (becameConverted) setCommercialLeadId(convertedId);
  };

  const saveFollowUpForLead = async (data, lead) => {
    const leadId = lead?._id;
    if (!leadId) throw new Error('Lead missing');

    const { statusUpdate, leadOutcome, ...followUpData } = data;
    void leadOutcome;

    // Always persist the follow-up first — status update failures must not block it
    await createExecutiveFollowUp(
      buildFollowUpPayload({
        ...followUpData,
        lead: leadId,
        statusReason:
          statusUpdate?.statusReason ||
          followUpData.outcome ||
          followUpData.pickedOutcome ||
          followUpData.notPickedReason ||
          followUpData.coldReason ||
          followUpData.lostReason,
      })
    );

    if (statusUpdate) {
      try {
        await API.put(`/sales-executive/leads/${leadId}`, statusUpdate);
        if (
          (data.remarks || statusUpdate.statusReason) &&
          ['lost', 'booked_from_another_company'].includes(statusUpdate.status)
        ) {
          await API.post(`/sales-executive/leads/${leadId}/notes`, {
            text: data.remarks || statusUpdate.statusReason,
          }).catch(() => {});
        }
        if (statusUpdate.status === 'converted') {
          setCommercialLeadId(leadId);
        }
      } catch (err) {
        const msg =
          err.response?.data?.message ||
          err.message ||
          'Lead status could not be updated';
        toast.error(`Follow-up saved. ${msg}`);
      }
    }

    setModal(null);
    fetchLeads();
  };

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
    columnHelper.accessor((row) => row.mealPlan || row.mealPreference || 'map', {
      id: 'mealPlan',
      header: 'Meal Plan',
      cell: ({ row }) => (
        <ExecMealPlanCell mealPlan={row.original.mealPlan} mealPreference={row.original.mealPreference} />
      ),
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
          <LeadActionsMenu
            lead={row.original}
            canChangeStatus={!isLeadStatusLocked(row.original.status)}
            onScheduleFollowUp={(lead) => { setModal({ type: 'followup', lead }); }}
            onChangeStatus={(lead) => {
              setModal({ type: 'status', lead });
            }}
          />
        </div>
        );
      },
    }),
  ], [queryClient]);

  return (
    <>
      <MobileExecutiveLeads
        filter={filter}
        title={meta.title}
        subtitle={meta.desc}
        leads={leads}
        loading={isLoading}
        search={search}
        onSearchChange={setSearch}
        statusFilter={isAllView ? statusFilter : ''}
        onStatusChange={setStatusFilter}
        destinationFilter={destinationFilter}
        onDestinationChange={setDestinationFilter}
        stateFilter={stateFilter}
        onStateChange={setStateFilter}
        priorityFilter={priorityFilter}
        onPriorityChange={setPriorityFilter}
        sourceFilter={sourceFilter}
        onSourceChange={setSourceFilter}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onPeriodSelect={setPeriod}
        onRefresh={fetchLeads}
        onOpenLead={(lead) => navigate(`/sales-executive/leads/${lead._id}/view`)}
      />

      <div className="hidden lg:block">
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

      <ExecutiveLeadsFilterBar
        search={search}
        onSearchChange={setSearch}
        statusFilter={isAllView ? statusFilter : ''}
        onStatusChange={setStatusFilter}
        destinationFilter={destinationFilter}
        onDestinationChange={setDestinationFilter}
        stateFilter={stateFilter}
        onStateChange={setStateFilter}
        priorityFilter={priorityFilter}
        onPriorityChange={setPriorityFilter}
        showStatusFilter={isAllView}
        showAddLead={false}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onPeriodSelect={setPeriod}
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
          getRowClassName={(lead) => {
            if (lead?.isHot) return 'bg-orange-50';
            return undefined;
          }}
        />
      )}

      <ExecutivePipelineCta />
    </ExecutivePageShell>
      </div>

      <LeadFollowUpOutcomeModal
        open={modal?.type === 'status'}
        lead={modal?.lead}
        onClose={() => setModal(null)}
        onSubmit={handleFollowUpOutcome}
      />

      <AddFollowUpModal
        open={modal?.type === 'followup'}
        onClose={() => setModal(null)}
        fixedLeadId={modal?.lead?._id}
        fixedLeadName={modal?.lead?.name}
        lead={modal?.lead}
        showLeadOutcome={modal?.lead ? !isLeadStatusLocked(modal.lead.status) : false}
        onSubmit={async (data) => {
          await saveFollowUpForLead(data, modal?.lead);
        }}
      />

      <PostConvertCommercialModal
        open={Boolean(commercialLeadId)}
        leadId={commercialLeadId}
        onClose={() => setCommercialLeadId(null)}
        onSaved={() => fetchLeads()}
      />
    </>
  );
}
