import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import API from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { canManageFollowUps } from '../../lib/followupPermissions';
import { useDataRefresh } from '../../hooks/useDataRefresh';
import { createExecutiveFollowUp, updateExecutiveFollowUp, buildFollowUpPayload } from './followupApi';
import FollowUpHeader from './FollowUpHeader';
import FollowUpKpiCards from './FollowUpKpiCards';
import FollowUpFilterBar from './FollowUpFilterBar';
import FollowUpDataTable from './FollowUpDataTable';
import FollowUpCalendar from './FollowUpCalendar';
import FollowUpTimeline from './FollowUpTimeline';
import MissedFollowUpsPanel from './MissedFollowUpsPanel';
import FollowUpConsolidatedReport from './FollowUpConsolidatedReport';
import FollowUpNotifications from './FollowUpNotifications';
import AddFollowUpModal from './AddFollowUpModal';
import FollowUpDetailDrawer from './FollowUpDetailDrawer';
import { unwrapList } from '../../utils/apiHelpers';
import {
  useFollowUpsQuery,
  useFollowUpSummaryQuery,
  useFollowUpsCalendarQuery,
} from '../../features/followups/hooks/useFollowUpsQuery';
import {
  buildNotifications,
  buildTimelineEntries,
  enrichFollowUp,
} from './followupUtils';
import { DEFAULT_PAGE_SIZE } from '../ui/TablePagination';

const emptyFilters = { search: '', status: '', priority: '', executive: '' };

/**
 * The `status` value each KPI tab needs alongside `kpiTab` to reproduce that KPI's exact backend
 * population (getFollowUpSummary's facets, queryHelpers.buildFollowUpTabFilter) — NOT a new
 * filtering system, just correctly driving the two existing params (`tab`/`kpiTab` and `status`)
 * together instead of leaving a stale `status` value from a prior selection combined in:
 * - today: buildDueTodayFollowUpFilter/the "today" facet is status:'pending' + scheduledAt today,
 *   but buildFollowUpTabFilter('today') only encodes the date half — status:'pending' must be
 *   supplied externally (this is also how the Admin Dashboard's deep link already works).
 * - missed: buildFollowUpTabFilter('missed') is a self-contained $or (status:'missed' OR
 *   overdue-pending) — any external `status` equality ANDed on top of that $or silently
 *   collapses it to just the overdue-pending branch (or nothing, once syncMissedFollowUps has
 *   already flipped those to 'missed') — this was the reported bug.
 * - upcoming: buildFollowUpTabFilter('upcoming') already includes status:'pending' internally.
 * - completed: buildFollowUpTabFilter has no 'completed' branch (falls through to `{}`) — the
 *   completed facet is status:'completed' alone, so it must be supplied externally.
 */
const KPI_TAB_STATUS = { today: 'pending', missed: '', upcoming: '', completed: 'completed' };

export default function FollowUpPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const canCreate = canManageFollowUps(user);
  const isAdminView = user?.role === 'admin';
  const followEndpoint = canCreate ? '/sales-executive/followups' : '/followups';
  const leadsEndpoint = canCreate ? '/sales-executive/leads' : '/leads';

  // Deep-link support for Action Required cards (?kpiTab=today|missed|upcoming|completed,
  // optionally &status=...). An explicit ?status= always wins; otherwise it's derived from
  // ?kpiTab= via KPI_TAB_STATUS so a bare ?kpiTab=missed link still reproduces that KPI's
  // exact population on open.
  const [searchParams] = useSearchParams();
  const initialKpiTab = searchParams.get('kpiTab') || '';
  const [view, setView] = useState('list');
  const [filters, setFilters] = useState(() => ({
    ...emptyFilters,
    status: searchParams.get('status') ?? (KPI_TAB_STATUS[initialKpiTab] ?? ''),
  }));
  const [kpiFilter, setKpiFilter] = useState(() => initialKpiTab);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: DEFAULT_PAGE_SIZE });
  const [modalOpen, setModalOpen] = useState(false);
  const [editFollowup, setEditFollowup] = useState(null);
  const [selected, setSelected] = useState(null);
  const [leads, setLeads] = useState([]);

  const kpiTab = kpiFilter || undefined;

  const listQuery = useFollowUpsQuery({
    filters,
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    kpiTab,
    endpoint: followEndpoint,
    enabled: view === 'list' || view === 'timeline',
  });

  const calendarQuery = useFollowUpsCalendarQuery({
    filters,
    endpoint: followEndpoint,
    enabled: view === 'calendar',
  });

  const summaryQuery = useFollowUpSummaryQuery(
    canCreate ? '/sales-executive/followups/summary' : '/followups/summary',
    true
  );

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['followups'] });
  }, [queryClient]);

  useDataRefresh(['followups', 'leads'], invalidate);

  useEffect(() => {
    if (!canCreate) return;
    API.get(leadsEndpoint, { params: { filter: 'all', limit: 100, page: 1 }, skipSuccessToast: true })
      .then((res) => setLeads(unwrapList(res.data)))
      .catch(() => setLeads([]));
  }, [canCreate, leadsEndpoint]);

  useEffect(() => {
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }, [filters, kpiFilter]);

  const listFollowups = listQuery.data?.data ?? [];
  const totalFollowups = listQuery.data?.pagination?.total ?? 0;
  const calendarFollowups = calendarQuery.data?.data ?? [];
  const loading = view === 'calendar' ? calendarQuery.isLoading : listQuery.isLoading;

  const kpis = useMemo(() => {
    const s = summaryQuery.data;
    if (s) {
      const total = s.total || 1;
      return {
        today: s.today || 0,
        missed: s.missed || 0,
        upcoming: s.upcoming || 0,
        completed: s.completed || 0,
        conversion: Math.round(((s.completed || 0) / total) * 1000) / 10,
        sparklines: { today: [s.today], missed: [s.missed], upcoming: [s.upcoming], completed: [s.completed] },
      };
    }
    return { today: 0, missed: 0, upcoming: 0, completed: 0, conversion: 0, sparklines: {} };
  }, [summaryQuery.data]);

  const missed = summaryQuery.data?.missedPreview?.map(enrichFollowUp) ?? [];
  const teamReport = summaryQuery.data?.teamReport ?? [];
  const notifications = useMemo(
    () => buildNotifications(calendarFollowups.length ? calendarFollowups : listFollowups),
    [calendarFollowups, listFollowups]
  );
  const timeline = useMemo(() => buildTimelineEntries(listFollowups), [listFollowups]);

  const filteredTimeline = useMemo(() => {
    if (!filters.search) return timeline;
    const q = filters.search.toLowerCase();
    return timeline.filter(
      (e) => e.customerName?.toLowerCase().includes(q) || e.destination?.toLowerCase().includes(q)
    );
  }, [timeline, filters.search]);

  const handleKpiFilter = (key) => {
    setKpiFilter((prev) => {
      const next = prev === key ? '' : key;
      // The selected KPI tab is authoritative over the manual status dropdown for the
      // population it represents — otherwise a leftover status from a previous KPI/manual
      // selection gets ANDed onto the new tab's filter and silently breaks it (see
      // KPI_TAB_STATUS above). Toggling a KPI off clears status back to unfiltered.
      setFilters((f) => ({ ...f, status: next ? (KPI_TAB_STATUS[next] ?? '') : '' }));
      return next;
    });
  };

  const handleAdd = async (data) => {
    if (!canCreate) throw new Error('Not allowed');
    if (editFollowup) {
      await updateExecutiveFollowUp(editFollowup._id, {
        action: 'reschedule',
        scheduledAt: new Date(data.scheduledAt).toISOString(),
        remarks: data.notes,
        category: data.category,
        priority: data.priority,
      });
    } else {
      await createExecutiveFollowUp(buildFollowUpPayload(data));
    }
    setEditFollowup(null);
    invalidate();
  };

  const handleComplete = async (id) => {
    if (!canCreate) return;
    try {
      await updateExecutiveFollowUp(id, { action: 'complete', remarks: 'Follow-up completed successfully' });
      setSelected(null);
      invalidate();
    } catch {
      /* toast via axios */
    }
  };

  const openReschedule = (f) => {
    setEditFollowup(f);
    setModalOpen(true);
    setSelected(null);
  };

  const pageCount = Math.max(1, Math.ceil(totalFollowups / pagination.pageSize) || 1);

  if (loading && !listFollowups.length && !calendarFollowups.length) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-16 rounded-2xl bg-surface-elevated" />
        <div className="grid grid-cols-5 gap-4">{[...Array(5)].map((_, i) => <div key={i} className="h-24 rounded-2xl bg-surface-elevated" />)}</div>
        <div className="h-96 rounded-2xl bg-surface-elevated" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pb-8">
      <FollowUpHeader
        total={totalFollowups || summaryQuery.data?.total || 0}
        view={view}
        onViewChange={setView}
        canCreate={canCreate}
        onAdd={() => { setEditFollowup(null); setModalOpen(true); }}
      />
      {!canCreate && (
        <p className="text-sm text-content-muted mb-4 -mt-2">
          {isAdminView
            ? 'Consolidated team report — individual missed alerts are sent to executives, team leaders, and sales managers.'
            : 'View only — only sales executives can add or edit follow-ups.'}
        </p>
      )}

      <FollowUpKpiCards kpis={kpis} onFilter={handleKpiFilter} activeFilter={kpiFilter} />

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-8 space-y-4">
          {(view === 'list' || view === 'timeline') && (
            <FollowUpFilterBar filters={filters} onChange={(f) => { setFilters(f); setKpiFilter(''); }} />
          )}

          <AnimatePresence mode="wait">
            {view === 'list' && (
              <motion.div key="list" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <FollowUpDataTable
                  followups={listFollowups}
                  onSelect={setSelected}
                  onComplete={canCreate ? handleComplete : undefined}
                  onReschedule={canCreate ? openReschedule : undefined}
                  readOnly={!canCreate}
                  serverPagination={{
                    pageIndex: pagination.pageIndex,
                    pageSize: pagination.pageSize,
                    pageCount,
                    total: totalFollowups,
                    onPaginationChange: setPagination,
                  }}
                />
              </motion.div>
            )}
            {view === 'calendar' && (
              <motion.div key="cal" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <FollowUpCalendar followups={calendarFollowups} onEventClick={setSelected} />
              </motion.div>
            )}
            {view === 'timeline' && (
              <motion.div key="timeline" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <FollowUpTimeline entries={filteredTimeline} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <aside className="xl:col-span-4 space-y-4 xl:sticky xl:top-20">
          <FollowUpNotifications notifications={notifications} onSelect={setSelected} />
          {isAdminView ? (
            <FollowUpConsolidatedReport teamReport={teamReport} />
          ) : (
            <MissedFollowUpsPanel missed={missed} onSelect={setSelected} />
          )}
        </aside>
      </div>

      {canCreate && (
        <AddFollowUpModal
          open={modalOpen}
          onClose={() => { setModalOpen(false); setEditFollowup(null); }}
          onSubmit={handleAdd}
          leads={leads}
          editData={editFollowup}
        />
      )}

      {selected && (
        <FollowUpDetailDrawer
          followup={selected}
          onClose={() => setSelected(null)}
          onComplete={canCreate ? handleComplete : undefined}
          onReschedule={canCreate ? openReschedule : undefined}
          readOnly={!canCreate}
        />
      )}
    </motion.div>
  );
}
