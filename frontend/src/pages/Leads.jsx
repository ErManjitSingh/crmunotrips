import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import AdminAssignLeadModal from '../components/leads/AdminAssignLeadModal';
import LeadBranchTransferModal from '../components/leads/LeadBranchTransferModal';
import { useLeadAssign } from '../hooks/useLeadAssign';
import API from '../api/axios';
import { toast } from '../context/ToastContext';
import LeadPageHeader from '../components/leads/LeadPageHeader';
import LeadKpiStrip from '../components/leads/LeadKpiStrip';
import LeadFilterBar from '../components/leads/LeadFilterBar';
import LeadBulkActionsBar from '../components/leads/LeadBulkActionsBar';
import LeadDataTable from '../components/leads/LeadDataTable';
import LeadPreviewDrawer from '../components/leads/LeadPreviewDrawer';
import { pageConfig, emptyFilters } from '../components/leads/constants';
import { countActiveFilters } from '../components/leads/leadFilters';
import { useLeadsQuery } from '../features/leads/hooks/useLeadsQuery';
import { ALL_LEADS_PAGE_SIZE, LEADS_PAGE_SIZE } from '../components/ui/TablePagination';
import { useConfirmDialog } from '../hooks/useConfirmDialog';
import { assignAllowedRoles, canAssignLeads } from '../lib/canAssignLeads';
import BulkStatusModal from '../components/leads/BulkStatusModal';
import { bulkUpdateLeadStatus, bulkExportLeads } from '../services/leadEnterpriseApi';
import { invalidateLeadLists } from '../lib/queryInvalidation';
import MobileLeadList from '../components/leads/MobileLeadList';
import ConvertedLeadsTable from '../components/leads/ConvertedLeadsTable';
import { useSidebarCounts } from '../hooks/useSidebarCounts';
import { resolveListTotal } from '../lib/resolveListTotal';
import { applyPeriodPreset } from '../lib/periodFilters';

function filtersFromLocation(location, config) {
  const params = new URLSearchParams(location.search);
  let dateFrom = params.get('dateFrom') || '';
  let dateTo = params.get('dateTo') || '';
  if (config.todayOnly && !dateFrom && !dateTo) {
    const today = applyPeriodPreset('today');
    dateFrom = today.dateFrom;
    dateTo = today.dateTo;
  }
  return {
    ...emptyFilters,
    status: config.status || params.get('status') || '',
    filter: config.listFilter || params.get('filter') || '',
    listStatus: params.get('listStatus') || '',
    dateFrom,
    dateTo,
    source: params.get('source') || '',
    agent: params.get('agent') || '',
  };
}

export default function Leads() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { availableBranches, selectedBranchId } = useSelector((s) => s.branch);
  const { can } = usePermissions();
  const isAdmin = user?.role === 'admin';
  const isSalesManager = user?.role === 'sales_manager';
  const isLeadProvider = user?.role === 'lead_provider';
  const isManagerRole = isAdmin || isSalesManager;
  const isLimitedRole = ['team_leader', 'sales_executive'].includes(user?.role);
  const userCanAssignLeads = canAssignLeads(user?.role);
  const canEditLead = can('leads', 'edit');
  const canDeleteLead = can('leads', 'delete');
  const canImportExport = !isLeadProvider && (isManagerRole || isAdmin);
  const leadMenuActions = isLimitedRole
    ? { view: true, edit: false, assign: false, transferBranch: false, delete: false }
    : isLeadProvider
      ? { view: true, edit: canEditLead, assign: userCanAssignLeads, transferBranch: false, delete: false }
      : {
          view: true,
          edit: isManagerRole,
          assign: isManagerRole,
          transferBranch: isManagerRole,
          delete: isManagerRole && canDeleteLead,
        };
  const config = pageConfig[location.pathname] || pageConfig['/leads'];
  const isAllLeadsPage = location.pathname === '/leads';
  const isConvertedPage = location.pathname === '/leads/converted' || config.status === 'converted';

  const [filters, setFilters] = useState(() => filtersFromLocation(location, config));
  const [appliedFilters, setAppliedFilters] = useState(() => filtersFromLocation(location, config));
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: isAllLeadsPage ? ALL_LEADS_PAGE_SIZE : LEADS_PAGE_SIZE,
  });
  const [rowSelection, setRowSelection] = useState({});
  const [previewLead, setPreviewLead] = useState(null);
  const [transferLead, setTransferLead] = useState(null);
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
  const [pageCursors, setPageCursors] = useState({});
  const [isMobileViewport, setIsMobileViewport] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches
  );
  const { confirm, dialogNode } = useConfirmDialog();
  const DEEP_PAGE_INDEX = 9;

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const onChange = () => setIsMobileViewport(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const openLead = useCallback((lead) => {
    if (window.matchMedia('(max-width: 1023px)').matches) {
      navigate(`/leads/${lead._id}`);
      return;
    }
    setPreviewLead(lead);
  }, [navigate]);

  const apiFilters = useMemo(() => {
    const base = { ...appliedFilters };
    if (config.status && !base.status) base.status = config.status;
    if (config.assignee === 'unassigned') base.filter = 'unassigned';
    else if (config.assignee === 'assigned') base.filter = 'assigned';
    else if (config.listFilter && !base.filter) base.filter = config.listFilter;
    if (config.todayOnly && !base.dateFrom && !base.dateTo) {
      base.todayOnly = true;
    }
    return base;
  }, [appliedFilters, config.status, config.assignee, config.todayOnly, config.listFilter]);

  const activeCursor = pagination.pageIndex > DEEP_PAGE_INDEX ? pageCursors[pagination.pageIndex] : null;

  const tableQuery = useLeadsQuery({
    filters: apiFilters,
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    cursor: activeCursor,
  });

  const invalidateLeads = useCallback(() => {
    invalidateLeadLists(queryClient);
  }, [queryClient]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const statusFromQuery = params.get('status') || '';
    const nextStatus = config.status || statusFromQuery || '';
    let dateFrom = params.get('dateFrom') || '';
    let dateTo = params.get('dateTo') || '';
    if (config.todayOnly && !dateFrom && !dateTo) {
      const today = applyPeriodPreset('today');
      dateFrom = today.dateFrom;
      dateTo = today.dateTo;
    }
    const source = params.get('source') || '';
    const nextFilter = config.listFilter || params.get('filter') || '';
    setFilters((f) => ({ ...f, status: nextStatus, filter: nextFilter, dateFrom, dateTo, source }));
    setAppliedFilters((f) => ({ ...f, status: nextStatus, filter: nextFilter, dateFrom, dateTo, source }));
    setPagination({
      pageIndex: 0,
      pageSize: isAllLeadsPage ? ALL_LEADS_PAGE_SIZE : LEADS_PAGE_SIZE,
    });
    setPageCursors({});
  }, [config.status, config.assignee, config.listFilter, isAllLeadsPage, location.pathname, location.search]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const agent = params.get('agent') || '';
    if (!agent) return;
    setFilters((f) => ({ ...f, agent }));
    setAppliedFilters((f) => ({ ...f, agent }));
  }, [location.search]);

  useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }));
    setPageCursors({});
  }, [appliedFilters]);

  useEffect(() => {
    if (tableQuery.data?.nextCursor) {
      setPageCursors((prev) => ({
        ...prev,
        [pagination.pageIndex + 1]: tableQuery.data.nextCursor,
      }));
    }
  }, [tableQuery.data?.nextCursor, pagination.pageIndex]);

  const navCounts = useSidebarCounts();
  const tableLeads = tableQuery.data?.data ?? [];
  const hasMoreLeads = tableQuery.data?.hasMore ?? false;
  const hasListScope =
    Boolean(
      appliedFilters.dateFrom ||
        appliedFilters.dateTo ||
        appliedFilters.status ||
        appliedFilters.source ||
        appliedFilters.search ||
        config.status ||
        config.todayOnly ||
        config.assignee ||
        config.listFilter
    );
  const totalLeads = resolveListTotal({
    apiTotal: tableQuery.data?.pagination?.total,
    rowCount: tableLeads.length,
    pageIndex: pagination.pageIndex,
    pageSize: pagination.pageSize,
    hasMore: hasMoreLeads,
    fallbackTotal: isAllLeadsPage && !hasListScope ? navCounts?.leads?.all : undefined,
  });
  const loading = tableQuery.isLoading && !tableQuery.data;

  const selectedCount = Object.keys(rowSelection).filter((k) => rowSelection[k]).length;

  const refreshAfterAssign = useCallback(() => {
    invalidateLeads();
    setRowSelection({});
  }, [invalidateLeads]);

  const {
    assignees,
    assigneesLoading,
    assignModal,
    openAssign,
    openBulkAssign,
    closeAssign,
    handleAssign,
    assignConfirmDialog,
  } = useLeadAssign({ onAssigned: refreshAfterAssign });

  const selectedLeadIds = Object.keys(rowSelection).filter((k) => rowSelection[k]);

  const syncPeriodToUrl = useCallback((next) => {
    const params = new URLSearchParams(location.search);
    if (next.dateFrom) params.set('dateFrom', next.dateFrom);
    else params.delete('dateFrom');
    if (next.dateTo) params.set('dateTo', next.dateTo);
    else params.delete('dateTo');
    if (next.source) params.set('source', next.source);
    else params.delete('source');
    const search = params.toString();
    navigate({ pathname: location.pathname, search: search ? `?${search}` : '' }, { replace: true });
  }, [location.pathname, location.search, navigate]);

  const handleApply = () => {
    setAppliedFilters({ ...filters });
    syncPeriodToUrl(filters);
  };
  const handleMobileApply = (next) => {
    setFilters(next);
    setAppliedFilters(next);
    syncPeriodToUrl(next);
  };
  const handleReset = () => {
    const base = {
      ...emptyFilters,
      status: config.status || '',
      filter: config.listFilter || '',
    };
    setFilters(base);
    setAppliedFilters(base);
    const params = new URLSearchParams(location.search);
    params.delete('dateFrom');
    params.delete('dateTo');
    params.delete('source');
    if (!config.status) params.delete('status');
    const search = params.toString();
    navigate({ pathname: location.pathname, search: search ? `?${search}` : '' }, { replace: true });
  };
  const handlePeriodSelect = (key) => {
    const dates = applyPeriodPreset(key);
    const next = { ...filters, ...dates };
    setFilters(next);
    setAppliedFilters(next);
    syncPeriodToUrl(next);
  };
  const handleQuickFilter = (next) => {
    setFilters(next);
    setAppliedFilters(next);
    syncPeriodToUrl(next);
  };

  const handleDelete = async (id) => {
    const ok = await confirm({
      title: 'Delete lead?',
      message: 'This lead will be deleted permanently.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;
    await API.delete(`/leads/${id}`);
    setPreviewLead(null);
    invalidateLeads();
  };

  const handleTransferBranch = async ({ leadId, branchId }) => {
    const branch = availableBranches.find((b) => b._id === branchId);
    const ok = await confirm({
      title: 'Transfer lead to another branch?',
      message: `Do you want to transfer this lead to ${branch?.name || 'the selected branch'}?`,
      confirmLabel: 'Transfer',
      cancelLabel: 'Cancel',
      tone: 'warning',
    });
    if (!ok) return;

    setTransferSubmitting(true);
    try {
      await API.patch(`/leads/${leadId}/transfer-branch`, { branchId });
      setTransferLead(null);
      invalidateLeads();
    } finally {
      setTransferSubmitting(false);
    }
  };

  const handleBulkStatus = async (status, statusReason) => {
    const ids = Object.keys(rowSelection).filter((k) => rowSelection[k]);
    await bulkUpdateLeadStatus(ids, status, statusReason);
    setRowSelection({});
    setBulkStatusOpen(false);
    invalidateLeads();
  };

  const handleBulkExport = async () => {
    const ids = Object.keys(rowSelection).filter((k) => rowSelection[k]);
    if (!ids.length) return;
    await bulkExportLeads(ids);
    toast.success(`Exported ${ids.length} leads`);
  };

  const handleBulkDelete = async () => {
    const ids = Object.keys(rowSelection).filter((k) => rowSelection[k]);
    const ok = await confirm({
      title: 'Delete selected leads?',
      message: `You are about to delete ${ids.length} leads permanently.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;
    await Promise.all(ids.map((id) => API.delete(`/leads/${id}`)));
    setRowSelection({});
    invalidateLeads();
  };

  const pageCount =
    totalLeads != null
      ? Math.max(1, Math.ceil(totalLeads / pagination.pageSize) || 1)
      : hasMoreLeads
        ? pagination.pageIndex + 2
        : pagination.pageIndex + 1;

  return (
    <div className="animate-fade-up">
      {isAdmin && isMobileViewport && (
        <MobileLeadList
          title={config.title}
          subtitle={config.subtitle}
          leads={tableLeads}
          total={totalLeads}
          loading={loading}
          filters={filters}
          onFiltersChange={setFilters}
          onApplyFilters={handleMobileApply}
          onReset={handleReset}
          onOpenLead={openLead}
          hasMore={hasMoreLeads}
          pagination={{
            pageIndex: pagination.pageIndex,
            pageSize: pagination.pageSize,
            onPageChange: (pageIndex) => setPagination((current) => ({ ...current, pageIndex })),
          }}
        />
      )}

      <div className={isAdmin ? (isMobileViewport ? 'hidden' : 'block') : ''}>
        <LeadPageHeader
          title={config.title}
          total={isAllLeadsPage ? undefined : totalLeads ?? undefined}
          compact={isAllLeadsPage}
        />

        {isAllLeadsPage && <LeadKpiStrip />}

        <LeadFilterBar
          filters={filters}
          onChange={setFilters}
          onApply={handleApply}
          onReset={handleReset}
          onPeriodSelect={handlePeriodSelect}
          onQuickFilter={handleQuickFilter}
          activeCount={countActiveFilters(appliedFilters)}
        />

        <LeadBulkActionsBar
          count={selectedCount}
          onClear={() => setRowSelection({})}
          onAssign={userCanAssignLeads ? () => openBulkAssign(selectedLeadIds) : undefined}
          onStatusUpdate={isManagerRole || isLeadProvider ? () => setBulkStatusOpen(true) : undefined}
          onExport={canImportExport ? handleBulkExport : undefined}
          onDelete={canDeleteLead ? handleBulkDelete : undefined}
        />

        {loading ? (
          <div className="rounded-2xl border border-subtle bg-white p-16 text-center text-content-muted shadow-sm">
            Loading leads...
          </div>
        ) : isConvertedPage ? (
          <ConvertedLeadsTable
            leads={tableLeads}
            onRowClick={openLead}
            detailBasePath="/leads"
            serverPagination={{
              pageIndex: pagination.pageIndex,
              pageSize: pagination.pageSize,
              pageCount,
              total: totalLeads,
              hasMore: hasMoreLeads,
              onPaginationChange: setPagination,
            }}
          />
        ) : (
          <LeadDataTable
            leads={tableLeads}
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            onRowClick={openLead}
            onDelete={canDeleteLead ? handleDelete : undefined}
            onAssign={userCanAssignLeads ? openAssign : undefined}
            onTransferBranch={isManagerRole ? setTransferLead : undefined}
            onAccepted={invalidateLeads}
            onAcceptExpired={invalidateLeads}
            canEditLead={(isManagerRole || isLeadProvider) && canEditLead}
            menuActions={leadMenuActions}
            showAssignButton={userCanAssignLeads}
            onExport={canImportExport ? handleBulkExport : undefined}
            serverPagination={{
              pageIndex: pagination.pageIndex,
              pageSize: pagination.pageSize,
              pageCount,
              total: totalLeads,
              hasMore: hasMoreLeads,
              onPaginationChange: setPagination,
            }}
          />
        )}
      </div>

      <LeadPreviewDrawer
        lead={previewLead}
        onClose={() => setPreviewLead(null)}
        onAssign={userCanAssignLeads ? openAssign : undefined}
        onDelete={canDeleteLead ? handleDelete : undefined}
        onTransferBranch={isAdmin ? setTransferLead : undefined}
        canEditLead={canEditLead}
      />

      {userCanAssignLeads && (
        <AdminAssignLeadModal
          open={!!assignModal}
          lead={assignModal}
          assignees={assignees}
          loading={assigneesLoading}
          onClose={closeAssign}
          onAssign={handleAssign}
          allowedRoles={assignAllowedRoles(user?.role)}
        />
      )}
      {assignConfirmDialog}
      {dialogNode}

      {isManagerRole && (
        <BulkStatusModal
          open={bulkStatusOpen}
          onClose={() => setBulkStatusOpen(false)}
          count={selectedCount}
          onSubmit={handleBulkStatus}
        />
      )}

      {isAdmin && (
        <LeadBranchTransferModal
          open={!!transferLead}
          lead={transferLead}
          branches={availableBranches.filter((b) => b._id !== selectedBranchId)}
          submitting={transferSubmitting}
          onClose={() => setTransferLead(null)}
          onSubmit={handleTransferBranch}
        />
      )}
    </div>
  );
}
