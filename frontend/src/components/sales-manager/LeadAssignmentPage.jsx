import { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import { motion } from 'framer-motion';
import { UserPlus, Zap, Search, CheckSquare, Square, Inbox, Eye } from 'lucide-react';
import API from '../../api/axios';
import { useDataRefresh } from '../../hooks/useDataRefresh';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { unwrapPagination } from '../../utils/apiHelpers';
import TablePagination, { DEFAULT_PAGE_SIZE } from '../ui/TablePagination';
import PageHeader from '../ui/PageHeader';
import { Button } from '../ui/button';
import PriorityBadge from './PriorityBadge';
import AssignTeamLeadModal from './teams/AssignTeamLeadModal';
import AdminAssignLeadModal from '../leads/AdminAssignLeadModal';
import { useLeadAssign } from '../../hooks/useLeadAssign';
import {
  LeadIdPill,
  SourceBadge,
  DestinationChip,
  BudgetBadge,
  ManagerStatusBadge,
  CustomerCell,
  FILTER_THEMES,
} from './LeadListBadges';
import { leadListRowClass, LEAD_LIST_TD } from '../leads/leadListStyles';
import { cn } from '../../lib/utils';

const AUTO_RULES = [
  { id: 'destination-match', name: 'Destination Match', desc: 'Auto-assign on lead create (currently disabled — manual assign only)', enabled: false, color: 'from-emerald-500/20 to-teal-500/15 border-emerald-500/25' },
  { id: 'load-balance', name: 'Lowest Active Leads', desc: 'Prefer executive with fewest active pipeline leads', enabled: false, color: 'from-sky-500/20 to-blue-500/15 border-sky-500/25' },
  { id: 'round-robin', name: 'Round Robin', desc: 'Tie-breaker when multiple executives have the same load', enabled: false, color: 'from-violet-500/20 to-purple-500/15 border-violet-500/25' },
  { id: 'fallback-queue', name: 'Branch Fallback', desc: 'Used when no destination specialist is available', enabled: false, color: 'from-amber-500/20 to-orange-500/15 border-amber-500/25' },
];

const theme = FILTER_THEMES.unassigned;
const columns = ['Lead ID', 'Customer', 'Destination', 'Budget', 'Source', 'Intent', 'Status', 'Actions'];

export default function LeadAssignmentPage() {
  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [teams, setTeams] = useState([]);
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 500);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE });
  const [modalLead, setModalLead] = useState(null);
  const [assignMode, setAssignMode] = useState('quick');
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(() => {
    setLoading(true);
    Promise.all([
      API.get('/sales-manager/leads', {
        params: {
          filter: 'unassigned',
          search: debouncedSearch || undefined,
          page: pagination.pageIndex + 1,
          limit: pagination.pageSize,
        },
        skipSuccessToast: true,
      }),
      API.get('/sales-manager/teams', { skipSuccessToast: true }),
    ])
      .then(([l, t]) => {
        const parsed = unwrapPagination(l.data);
        setLeads(parsed.data);
        setTotal(parsed.pagination?.total ?? parsed.data.length);
        setTeams(t.data);
        if (!t.data?.length) setAssignMode('quick');
      })
      .finally(() => setLoading(false));
  }, [debouncedSearch, pagination.pageIndex, pagination.pageSize]);

  const {
    assignees,
    assigneesLoading,
    handleAssign: submitAssign,
    assignConfirmDialog,
  } = useLeadAssign({ onAssigned: fetchData });

  useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }, [debouncedSearch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useDataRefresh(['leads'], fetchData);

  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const toggleAll = () => setSelected(selected.length === leads.length ? [] : leads.map((l) => l._id));

  const handleAssign = async (payload) => {
    await submitAssign({
      assigneeRole: payload.assigneeRole,
      assigneeId: payload.assigneeId,
      leadIds: payload.leadIds || selected,
    });
    setSelected([]);
    setModalLead(null);
  };

  const openAssign = (lead) => {
    setAssignMode(teams.length ? 'team' : 'quick');
    setModalLead(lead);
  };

  const pageCount = Math.max(1, Math.ceil(total / pagination.pageSize) || 1);
  const scrollRef = useRef(null);
  const rowVirtualizer = useVirtualizer({
    count: leads.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 56,
    overscan: 8,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom =
    virtualRows.length > 0 ? rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lead Assignment"
        description="Manual assignment only — auto-assign is off for now"
        breadcrumbs={['Sales Manager', 'Lead Assignment']}
        actions={
          selected.length > 0 && (
            <Button onClick={() => openAssign({ bulk: true, count: selected.length })} variant="gradient">
              <UserPlus className="w-4 h-4 mr-1.5" /> Bulk Assign ({selected.length})
            </Button>
          )
        }
      />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl border ${theme.border} bg-gradient-to-r ${theme.gradient} p-5 flex items-center gap-4`}
      >
        <div className="p-3 rounded-2xl bg-surface/80 text-amber-600"><Inbox className="w-6 h-6" /></div>
        <div>
          <p className="text-2xl font-bold text-content-primary tabular-nums">{loading ? '—' : total}</p>
          <p className="text-sm text-content-secondary">Unassigned leads waiting for assignment</p>
        </div>
      </motion.div>

      {teams.length > 0 && (
        <div className="flex gap-2 p-1 rounded-xl bg-surface-elevated/50 border border-subtle w-fit">
          <button
            type="button"
            onClick={() => setAssignMode('quick')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${assignMode === 'quick' ? 'bg-violet-500/15 text-violet-700' : 'text-content-muted'}`}
          >
            Quick assign (executive)
          </button>
          <button
            type="button"
            onClick={() => setAssignMode('team')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${assignMode === 'team' ? 'bg-violet-500/15 text-violet-700' : 'text-content-muted'}`}
          >
            Assign via team
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {AUTO_RULES.map((rule, i) => (
          <motion.div
            key={rule.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className={`rounded-2xl border bg-gradient-to-br ${rule.color} backdrop-blur-xl p-4 shadow-sm opacity-80`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <Zap className={`w-4 h-4 ${rule.enabled ? 'text-amber-500' : 'text-content-muted'}`} />
                <h3 className="font-semibold text-sm text-content-primary">{rule.name}</h3>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full ring-1 ring-inset bg-surface-elevated text-content-muted">
                Soon
              </span>
            </div>
            <p className="text-xs text-content-muted mt-2">{rule.desc}</p>
          </motion.div>
        ))}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search unassigned leads…" className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-amber-500/25 bg-surface/80 text-sm outline-none focus:ring-2 focus:ring-amber-500/30" />
      </div>

      <div className="rounded-2xl border border-subtle bg-white shadow-sm overflow-hidden">
        <div ref={scrollRef} className="overflow-auto max-h-[min(70vh,680px)]">
          <table className="w-full text-sm table-auto border-collapse min-w-[900px]">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-subtle bg-slate-50">
                <th className="text-left px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-8">
                  <button type="button" onClick={toggleAll} className="text-amber-600 hover:text-amber-500">
                    {selected.length === leads.length && leads.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                  </button>
                </th>
                {columns.map((h) => (
                  <th key={h} className="text-left px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="p-12 text-center text-content-muted">Loading…</td></tr>
              ) : leads.length === 0 ? (
                <tr><td colSpan={9} className="p-12 text-center text-content-muted">No unassigned leads</td></tr>
              ) : (
                <>
                  {paddingTop > 0 && (
                    <tr aria-hidden><td colSpan={9} style={{ height: paddingTop, padding: 0, border: 0 }} /></tr>
                  )}
                  {virtualRows.map((virtualRow) => {
                    const lead = leads[virtualRow.index];
                    const i = virtualRow.index;
                    return (
                      <tr
                        key={lead._id}
                        className={cn(
                          'group border-b border-slate-100 last:border-0',
                          selected.includes(lead._id)
                            ? 'bg-amber-100 hover:bg-amber-100'
                            : lead.isHot
                              ? 'bg-orange-50 hover:bg-sky-100/80'
                              : leadListRowClass(i)
                        )}
                      >
                        <td className={LEAD_LIST_TD}>
                          <button type="button" onClick={() => toggle(lead._id)} className="text-content-muted hover:text-amber-600">
                            {selected.includes(lead._id) ? <CheckSquare className="w-3.5 h-3.5 text-amber-600" /> : <Square className="w-3.5 h-3.5" />}
                          </button>
                        </td>
                        <td className={LEAD_LIST_TD}><LeadIdPill id={lead.leadId} /></td>
                        <td className={LEAD_LIST_TD}><div className="flex items-center gap-1 min-w-0 flex-wrap"><CustomerCell name={lead.name} lead={lead} /><PriorityBadge lead={lead} /></div></td>
                        <td className={LEAD_LIST_TD}><DestinationChip name={lead.destination} /></td>
                        <td className={LEAD_LIST_TD}><BudgetBadge amount={lead.budget} /></td>
                        <td className={LEAD_LIST_TD}><SourceBadge source={lead.source} label={lead.sourceLabel} /></td>
                        <td className={LEAD_LIST_TD}><PriorityBadge lead={lead} /></td>
                        <td className={LEAD_LIST_TD}><ManagerStatusBadge status={lead.status} /></td>
                        <td className={LEAD_LIST_TD}>
                          <div className="flex items-center gap-1">
                            <Link to={`/sales-manager/leads/${lead._id}/view`} className="inline-flex items-center h-7 px-2 rounded-md border border-subtle text-[11px] font-medium hover:bg-surface-elevated">
                              <Eye className="w-3 h-3 mr-0.5" /> View
                            </Link>
                            <Button size="sm" variant="gradient" onClick={() => openAssign(lead)} className="h-7 px-2 text-[11px]">
                              <UserPlus className="w-3 h-3 mr-0.5" /> Assign
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {paddingBottom > 0 && (
                    <tr aria-hidden><td colSpan={9} style={{ height: paddingBottom, padding: 0, border: 0 }} /></tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
        {!loading && leads.length > 0 && (
          <TablePagination
            pageIndex={pagination.pageIndex}
            pageSize={pagination.pageSize}
            pageCount={pageCount}
            total={total}
            onPageChange={(pageIndex) => setPagination((p) => ({ ...p, pageIndex }))}
            onPageSizeChange={(pageSize) => setPagination({ pageIndex: 0, pageSize })}
            totalLabel="leads"
            showPageNumbers
            className="border-t border-subtle bg-surface/50"
          />
        )}
      </div>

      {(assignMode === 'quick' || !teams.length) && (
        <AdminAssignLeadModal
          open={!!modalLead}
          lead={modalLead}
          assignees={assignees}
          loading={assigneesLoading}
          onClose={() => setModalLead(null)}
          onAssign={handleAssign}
          allowedRoles={['sales_manager', 'team_leader', 'sales_executive']}
        />
      )}
      {assignMode === 'team' && teams.length > 0 && (
        <AssignTeamLeadModal
          open={!!modalLead}
          lead={modalLead}
          teams={teams}
          onClose={() => setModalLead(null)}
          onAssign={handleAssign}
        />
      )}
      {assignConfirmDialog}
    </div>
  );
}
