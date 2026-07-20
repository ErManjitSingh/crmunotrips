import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { RefreshCw, Eye, UserPlus, Sparkles } from 'lucide-react';
import API from '../../api/axios';
import PageHeader from '../ui/PageHeader';
import TablePagination, { DEFAULT_PAGE_SIZE } from '../ui/TablePagination';
import {
  LeadIdPill,
  DestinationChip,
  ExecutiveBadge,
  ManagerStatusBadge,
  CustomerCell,
} from '../sales-manager/LeadListBadges';
import { Button } from '../ui/button';
import { useAuth } from '../../context/AuthContext';
import { useLeadReactivate } from '../../hooks/useLeadReactivate';
import ReactivationActionsModal from '../lead-detail/ReactivationActionsModal';
import {
  ReactivationHeroBanner,
  ReactivationFlowSteps,
  ReactivationStageKpis,
  ReactivationFiltersPanel,
  ReactivationEmptyState,
} from './ReactivationPanelUi';
import { compactTable, compactTd } from '../ui/compactTable';
import { leadListRowClass } from './leadListStyles';

const STAGES = [
  { value: '', label: 'All Stages' },
  { value: 'reactivated', label: 'Reactivated' },
  { value: 'reassigned', label: 'Reassigned' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'follow_up_scheduled', label: 'Follow Up Scheduled' },
  { value: 'quotation_sent', label: 'Quotation Sent' },
  { value: 'converted', label: 'Converted' },
];

const STATUSES = [
  { value: '', label: 'All Statuses' },
  { value: 'reactivated', label: 'Reactivated' },
  { value: 'follow_up', label: 'Active (Follow-up)' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'quotation_sent', label: 'Quotation Sent' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'converted', label: 'Converted' },
];

function getPageConfig(pathname) {
  if (pathname.startsWith('/sales-manager')) {
    return {
      title: 'Reactivated Leads',
      breadcrumbs: ['Sales Manager', 'Reactivated Leads'],
      listUrl: '/sales-manager/leads',
      dashboardUrl: '/sales-manager/dashboard',
      detailPath: (id) => `/sales-manager/leads/${id}/view`,
      getParams: (state) => ({
        filter: 'reactivated',
        search: state.search || undefined,
        reactivationStage: state.stage || undefined,
        status: state.status || undefined,
        executiveId: state.executiveId || undefined,
        reactivatedFrom: state.from || undefined,
        reactivatedTo: state.to || undefined,
        page: state.page,
        limit: state.limit,
      }),
    };
  }

  if (pathname.startsWith('/team-leader')) {
    return {
      title: 'Reactivated Squad Leads',
      breadcrumbs: ['Team Leader', 'Reactivated Leads'],
      listUrl: '/team-leader/leads',
      dashboardUrl: '/team-leader/dashboard',
      detailPath: (id) => `/team-leader/leads/${id}/view`,
      getParams: (state) => ({
        filter: 'reactivated',
        search: state.search || undefined,
        reactivationStage: state.stage || undefined,
        status: state.status || undefined,
        executiveId: state.executiveId || undefined,
        reactivatedFrom: state.from || undefined,
        reactivatedTo: state.to || undefined,
        page: state.page,
        limit: state.limit,
      }),
    };
  }

  return {
    title: 'Reactivated Leads',
    breadcrumbs: ['Admin', 'Reactivated Leads'],
    listUrl: '/leads',
    dashboardUrl: '/dashboard/stats',
    detailPath: (id) => `/leads/${id}`,
    getParams: (state) => ({
      reactivatedOnly: true,
      reactivationStage: state.stage || undefined,
      status: state.status || undefined,
      executiveId: state.executiveId || undefined,
      reactivatedFrom: state.from || undefined,
      reactivatedTo: state.to || undefined,
      search: state.search || undefined,
      page: state.page,
      limit: state.limit,
    }),
  };
}

function formatStage(stage) {
  return (stage || 'reactivated').replace(/_/g, ' ');
}

export default function ReactivatedLeadsPage() {
  const location = useLocation();
  const { user } = useAuth();
  const canManage = ['admin', 'sales_manager', 'team_leader'].includes(user?.role);
  const config = useMemo(() => getPageConfig(location.pathname), [location.pathname]);

  const [search, setSearch] = useState('');
  const [stage, setStage] = useState('');
  const [status, setStatus] = useState('');
  const [executiveId, setExecutiveId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [executives, setExecutives] = useState([]);
  const [rows, setRows] = useState([]);
  const [widget, setWidget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLead, setActionLead] = useState(null);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE, total: 0 });

  const reactivate = useLeadReactivate({
    leadId: actionLead?._id,
    onSuccess: () => {
      setActionLead(null);
      load();
    },
  });

  const hasActiveFilters = Boolean(search || stage || status || executiveId || from || to);

  useEffect(() => {
    if (!canManage) return;
    API.get('/leads/assignees', { skipSuccessToast: true, skipErrorToast: true })
      .then((r) => setExecutives(r.data?.salesExecutives || []))
      .catch(() => setExecutives([]));
  }, [canManage]);

  const load = useCallback(() => {
    setLoading(true);
    const page = pagination.pageIndex + 1;
    const limit = pagination.pageSize;
    return Promise.all([
      API.get(config.listUrl, {
        params: config.getParams({ search, stage, status, executiveId, from, to, page, limit }),
        skipSuccessToast: true,
      }),
      API.get(config.dashboardUrl, { skipSuccessToast: true }),
    ])
      .then(([listRes, dashboardRes]) => {
        const payload = listRes.data?.data ? listRes.data : { data: listRes.data, pagination: {} };
        setRows(payload.data || []);
        setPagination((prev) => ({
          ...prev,
          total: payload.pagination?.total ?? payload.data?.length ?? 0,
        }));
        setWidget(dashboardRes.data?.reactivationWidget || null);
      })
      .finally(() => setLoading(false));
  }, [config, pagination.pageIndex, pagination.pageSize, search, stage, status, executiveId, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const pageCount = Math.max(1, Math.ceil((pagination.total || 0) / pagination.pageSize));

  const resetPage = () => setPagination((p) => ({ ...p, pageIndex: 0 }));

  const resetFilters = () => {
    setSearch('');
    setStage('');
    setStatus('');
    setExecutiveId('');
    setFrom('');
    setTo('');
    resetPage();
  };

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title={config.title}
        description="Lost leads ko recover karo — stage, executive aur date se filter karo"
        breadcrumbs={config.breadcrumbs}
      />

      <ReactivationFlowSteps />

      <ReactivationHeroBanner
        title={config.title}
        subtitle="Executive follow-up ke baad status Active dikhega"
        total={pagination.total}
        loading={loading}
        icon={RefreshCw}
      />

      <ReactivationStageKpis
        widget={widget}
        activeStage={stage}
        onStageClick={(s) => {
          setStage(s);
          resetPage();
        }}
      />

      <ReactivationFiltersPanel
        search={search}
        onSearchChange={(v) => { setSearch(v); resetPage(); }}
        stage={stage}
        onStageChange={(v) => { setStage(v); resetPage(); }}
        status={status}
        onStatusChange={(v) => { setStatus(v); resetPage(); }}
        executiveId={executiveId}
        onExecutiveChange={(v) => { setExecutiveId(v); resetPage(); }}
        executives={executives}
        from={from}
        onFromChange={(v) => { setFrom(v); resetPage(); }}
        to={to}
        onToChange={(v) => { setTo(v); resetPage(); }}
        stages={STAGES}
        statuses={STATUSES}
        onRefresh={load}
        onClear={resetFilters}
        hasActiveFilters={hasActiveFilters}
      />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-teal-500/25 bg-surface/80 backdrop-blur-xl overflow-hidden shadow-lg shadow-teal-500/5"
      >
        {loading ? (
          <div className="p-16 text-center">
            <div className="w-9 h-9 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-content-muted text-sm">Loading reactivated leads…</p>
          </div>
        ) : rows.length === 0 ? (
          <ReactivationEmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className={compactTable}>
              <thead>
                <tr className="border-b border-subtle bg-slate-50">
                  {['Lead ID', 'Customer', 'Destination', 'Executive', 'Stage', 'Status', 'Reactivated', 'Actions'].map((h) => (
                    <th key={h} className="text-left px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((lead, i) => (
                  <tr
                    key={lead._id}
                    className={leadListRowClass(i)}
                  >
                    <td className={compactTd}><LeadIdPill id={lead.leadId} /></td>
                    <td className={compactTd}>
                      <CustomerCell name={lead.name} lead={lead} />
                    </td>
                    <td className={compactTd}><DestinationChip name={lead.destination} /></td>
                    <td className={compactTd}>
                      <ExecutiveBadge name={lead.assignedTo?.name} unassigned={!lead.assignedTo} />
                    </td>
                    <td className={compactTd}>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize bg-teal-500/10 text-teal-800 ring-1 ring-teal-500/20">
                        <Sparkles className="w-3 h-3" />
                        {formatStage(lead.reactivation?.stage)}
                      </span>
                    </td>
                    <td className={compactTd}>
                      <ManagerStatusBadge status={lead.status} lead={lead} />
                    </td>
                    <td className={compactTd}>
                      <span className="text-[11px] text-content-secondary whitespace-nowrap">
                        {lead.reactivation?.reactivatedAt
                          ? new Date(lead.reactivation.reactivatedAt).toLocaleString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </span>
                    </td>
                    <td className={compactTd}>
                      <div className="flex items-center gap-1">
                        <Link
                          to={config.detailPath(lead._id)}
                          className="inline-flex items-center h-7 px-2 rounded-md border border-subtle text-[11px] font-medium hover:bg-surface-elevated"
                        >
                          <Eye className="w-3 h-3 mr-0.5" /> View
                        </Link>
                        {canManage && lead.status === 'reactivated' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[11px]"
                            onClick={() => {
                              setActionLead(lead);
                              reactivate.openReassign();
                            }}
                          >
                            <UserPlus className="w-3 h-3 mr-0.5" /> Reassign
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && rows.length > 0 && (
          <TablePagination
            pageIndex={pagination.pageIndex}
            pageSize={pagination.pageSize}
            pageCount={pageCount}
            total={pagination.total}
            onPageChange={(pageIndex) => setPagination((p) => ({ ...p, pageIndex }))}
            onPageSizeChange={(pageSize) => setPagination({ pageIndex: 0, pageSize, total: pagination.total })}
            className="border-teal-500/15 bg-surface/50"
          />
        )}
      </motion.div>

      {canManage && (
        <ReactivationActionsModal
          open={!!actionLead && reactivate.mode === 'reassign'}
          mode="reassign"
          executives={executives}
          onClose={() => {
            reactivate.close();
            setActionLead(null);
          }}
          onSubmit={reactivate.submit}
        />
      )}
    </div>
  );
}
