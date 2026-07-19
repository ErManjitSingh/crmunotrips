import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Plus,
  CalendarClock,
  AlertTriangle,
  Clock,
  LayoutList,
  LayoutGrid,
  SlidersHorizontal,
} from 'lucide-react';
import API from '../../api/axios';
import { unwrapList } from '../../utils/apiHelpers';
import { useDataRefresh } from '../../hooks/useDataRefresh';
import ExecutivePageShell from './ExecutivePageShell';
import ExecutiveFollowUpKpiStrip from './ExecutiveFollowUpKpiStrip';
import ExecutiveFollowUpRow from './ExecutiveFollowUpRow';
import ExecutiveFollowUpCta from './ExecutiveFollowUpCta';
import { Button } from '../ui/button';
import { executiveInput } from './executivePageStyles';
import AddFollowUpModal from '../followups/AddFollowUpModal';
import { FOLLOWUP_TYPES, FOLLOWUP_STATUSES, FOLLOWUP_PRIORITIES } from '../followups/constants';
import {
  createExecutiveFollowUp,
  updateExecutiveFollowUp,
  buildFollowUpPayload,
} from '../followups/followupApi';
import { ActionModal } from './LeadActionsMenu';
import { cn } from '../../lib/utils';

const TIME_TABS = [
  { id: 'today', label: "Today's", icon: CalendarClock },
  { id: 'upcoming', label: 'Upcoming', icon: Clock },
  { id: 'missed', label: 'Missed', icon: AlertTriangle },
];

function withEffectiveStatus(f) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const scheduled = new Date(f.scheduledAt);
  const effectiveStatus =
    f.status === 'pending' && scheduled < start ? 'missed' : f.status;
  return { ...f, effectiveStatus };
}

function startOfMonth() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function ExecutiveFollowUpsPage() {
  const [tab, setTab] = useState('today');
  const [category, setCategory] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [viewMode, setViewMode] = useState('list');
  const [followups, setFollowups] = useState([]);
  const [kpiCounts, setKpiCounts] = useState({ total: 0, warm: 0, cold: 0, converted: 0 });
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [modal, setModal] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [rescheduleAt, setRescheduleAt] = useState('');

  const fetchKpis = useCallback(() => {
    Promise.all([
      API.get('/sales-executive/followups/summary', { skipSuccessToast: true }),
      API.get('/sales-executive/followups', {
        params: { limit: 200 },
        skipSuccessToast: true,
      }),
    ])
      .then(([summaryRes, listRes]) => {
        const summary = summaryRes.data || {};
        const rows = unwrapList(listRes.data);
        const monthStart = startOfMonth();
        setKpiCounts({
          total: summary.total ?? rows.length,
          warm: rows.filter((f) => f.category === 'warm').length,
          cold: rows.filter((f) => f.category === 'cold').length,
          converted: rows.filter(
            (f) =>
              f.category === 'converted' ||
              (f.status === 'completed' && new Date(f.updatedAt || f.scheduledAt) >= monthStart)
          ).length,
        });
      })
      .catch(() => {});
  }, []);

  const fetchFollowups = useCallback(() => {
    setLoading(true);
    const params = { tab, limit: 100 };
    if (category) params.category = category;
    if (statusFilter) params.status = statusFilter;
    if (priorityFilter) params.priority = priorityFilter;
    API.get('/sales-executive/followups', { params, skipSuccessToast: true })
      .then((fu) => setFollowups(unwrapList(fu.data).map(withEffectiveStatus)))
      .catch(() => setFollowups([]))
      .finally(() => setLoading(false));
  }, [tab, category, statusFilter, priorityFilter]);

  const refreshAll = useCallback(() => {
    fetchFollowups();
    fetchKpis();
  }, [fetchFollowups, fetchKpis]);

  useEffect(() => {
    fetchFollowups();
  }, [fetchFollowups]);

  useEffect(() => {
    fetchKpis();
  }, [fetchKpis]);

  useEffect(() => {
    if (!addOpen) return;
    API.get('/sales-executive/leads', {
      params: { filter: 'all', limit: 100 },
      skipSuccessToast: true,
    }).then((ld) => setLeads(unwrapList(ld.data)));
  }, [addOpen]);

  useDataRefresh(['followups'], refreshAll);

  const visibleFollowups = useMemo(() => {
    if (!typeFilter) return followups;
    return followups.filter((f) => f.type === typeFilter);
  }, [followups, typeFilter]);

  const handleAdd = async (data) => {
    await createExecutiveFollowUp(buildFollowUpPayload(data));
    refreshAll();
  };

  const handleComplete = async () => {
    await updateExecutiveFollowUp(modal._id, { action: 'complete', remarks });
    setModal(null);
    setRemarks('');
    refreshAll();
  };

  const handleReschedule = async () => {
    await updateExecutiveFollowUp(modal._id, {
      action: 'reschedule',
      scheduledAt: rescheduleAt ? new Date(rescheduleAt).toISOString() : undefined,
      remarks,
    });
    setModal(null);
    setRemarks('');
    setRescheduleAt('');
    refreshAll();
  };

  const handleRemarksOnly = async () => {
    await updateExecutiveFollowUp(modal._id, { notes: remarks });
    setModal(null);
    setRemarks('');
    refreshAll();
  };

  const handleKpiSelect = (key) => {
    if (key === 'total') {
      setCategory('');
      setTab('today');
      return;
    }
    if (key === 'warm' || key === 'cold') {
      setCategory(key);
      setTab('today');
      return;
    }
    if (key === 'converted') {
      setCategory('converted');
      setTab('today');
    }
  };

  const selectClass =
    'h-9 rounded-xl border border-subtle bg-white dark:bg-slate-900 px-3 text-xs font-semibold text-content-secondary outline-none focus:ring-2 focus:ring-violet-400/30';

  return (
    <ExecutivePageShell
      title="Follow-ups"
      description="Add and manage warm, cold, converted & expected conversion follow-ups"
      action={(
        <Button
          className="rounded-xl shrink-0 gap-1.5 bg-[#5D5FEF] hover:bg-[#4f51e5] text-white border-0 shadow-md shadow-[#5D5FEF]/25"
          onClick={() => setAddOpen(true)}
        >
          <Plus className="w-4 h-4" /> Add Follow-up
        </Button>
      )}
    >
      <ExecutiveFollowUpKpiStrip
        counts={kpiCounts}
        activeKey={category || (tab === 'today' && !category ? 'total' : undefined)}
        onSelect={handleKpiSelect}
      />

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex items-center gap-1 border-b border-subtle overflow-x-auto">
          {TIME_TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={cn(
                  'relative flex items-center gap-2 px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors',
                  active ? 'text-[#5D5FEF]' : 'text-content-muted hover:text-content-primary'
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
                {active && (
                  <motion.span
                    layoutId="exec-fu-time-underline"
                    className="absolute left-2 right-2 -bottom-px h-0.5 rounded-full bg-[#5D5FEF]"
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className={selectClass}
          >
            <option value="">All Types</option>
            {FOLLOWUP_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={selectClass}
          >
            <option value="">All Status</option>
            {FOLLOWUP_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className={selectClass}
          >
            <option value="">All Priority</option>
            {FOLLOWUP_PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={selectClass}
          >
            <option value="">All Categories</option>
            <option value="warm">Warm</option>
            <option value="cold">Cold</option>
            <option value="converted">Converted</option>
            <option value="expected_conv">Expected Conversion</option>
          </select>
          <Button variant="outline" size="sm" className="rounded-xl h-9 gap-1.5 text-xs">
            <SlidersHorizontal className="w-3.5 h-3.5" /> Filters
          </Button>
          <div className="inline-flex rounded-xl border border-subtle p-0.5 bg-white dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={cn(
                'h-8 w-8 inline-flex items-center justify-center rounded-lg transition-colors',
                viewMode === 'list' ? 'bg-violet-50 text-[#5D5FEF]' : 'text-content-muted'
              )}
              title="List view"
            >
              <LayoutList className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={cn(
                'h-8 w-8 inline-flex items-center justify-center rounded-lg transition-colors',
                viewMode === 'grid' ? 'bg-violet-50 text-[#5D5FEF]' : 'text-content-muted'
              )}
              title="Grid view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div
        className={cn(
          viewMode === 'grid'
            ? 'grid grid-cols-1 lg:grid-cols-2 gap-3'
            : 'space-y-3'
        )}
      >
        {loading ? (
          <div className="rounded-2xl border border-subtle bg-white dark:bg-slate-900 p-12 text-center text-content-muted">
            Loading follow-ups…
          </div>
        ) : visibleFollowups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-subtle bg-white/60 dark:bg-slate-900/60 p-12 text-center">
            <CalendarClock className="w-10 h-10 text-violet-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-content-primary">No follow-ups here</p>
            <p className="text-xs text-content-muted mt-1">Try another tab or add a new follow-up.</p>
            <Button
              className="mt-4 rounded-xl bg-[#5D5FEF] hover:bg-[#4f51e5] text-white border-0"
              onClick={() => setAddOpen(true)}
            >
              <Plus className="w-4 h-4 mr-1" /> Add Follow-up
            </Button>
          </div>
        ) : (
          visibleFollowups.map((f, i) => (
            <motion.div
              key={f._id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.24) }}
            >
              <ExecutiveFollowUpRow
                followup={f}
                onComplete={() => {
                  setModal({ ...f, action: 'complete' });
                  setRemarks('');
                }}
                onReschedule={() => {
                  setModal({ ...f, action: 'reschedule' });
                  setRemarks('');
                  setRescheduleAt('');
                }}
                onRemarks={() => {
                  setModal({ ...f, action: 'remarks' });
                  setRemarks(f.notes || '');
                }}
              />
            </motion.div>
          ))
        )}
      </div>

      <ExecutiveFollowUpCta />

      <AddFollowUpModal open={addOpen} onClose={() => setAddOpen(false)} onSubmit={handleAdd} leads={leads} />

      <ActionModal
        open={!!modal}
        title={
          modal?.action === 'complete'
            ? 'Mark Completed'
            : modal?.action === 'reschedule'
              ? 'Reschedule Follow-up'
              : 'Add Remarks'
        }
        onClose={() => setModal(null)}
      >
        {modal?.action === 'reschedule' && (
          <input
            type="datetime-local"
            value={rescheduleAt}
            onChange={(e) => setRescheduleAt(e.target.value)}
            className={`w-full ${executiveInput} p-3 mb-3`}
          />
        )}
        <textarea
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          rows={3}
          placeholder="Remarks…"
          className={`w-full ${executiveInput} p-3 mb-4`}
        />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button>
          <Button
            onClick={
              modal?.action === 'reschedule'
                ? handleReschedule
                : modal?.action === 'remarks'
                  ? handleRemarksOnly
                  : handleComplete
            }
            className="bg-[#5D5FEF] hover:bg-[#4f51e5] text-white border-0"
          >
            {modal?.action === 'reschedule' ? 'Reschedule' : 'Save'}
          </Button>
        </div>
      </ActionModal>
    </ExecutivePageShell>
  );
}
