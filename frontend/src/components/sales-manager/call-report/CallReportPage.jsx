import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Clock, ListTree, BarChart3, Sparkles, PhoneCall, Activity } from 'lucide-react';
import API from '../../../api/axios';
import { useAuth } from '../../../context/AuthContext';
import { useDataRefresh } from '../../../hooks/useDataRefresh';
import PageHeader from '../../ui/PageHeader';
import CallReportHero from './CallReportHero';
import CallReportFilters, { applyCallReportPreset, activeCallReportPreset } from './CallReportFilters';
import ExecutiveSummaryCards from './ExecutiveSummaryCards';
import CallTimelineList from './CallTimelineList';
import TeamOverviewTable from './TeamOverviewTable';
import AnalyticsSection from './AnalyticsSection';
import CallDetailDrawer from './CallDetailDrawer';
import ExecutiveActivityPage from './executive-activity/ExecutiveActivityPage';

const TIMELINE_PAGE_SIZE = 20;

/**
 * `selfOnly` (Sales Executive access): locks the report to the authenticated user's own data —
 * the team roster is never fetched (that endpoint isn't authorized for this role anyway), the
 * executive selector/search/Team Overview/"back to team" UI are hidden, and `executiveId` never
 * becomes 'all', so every existing single-executive code path (summary/timeline/analytics) below
 * runs unchanged, just always scoped to `user`. The backend independently re-derives and enforces
 * this same scoping from the authenticated session — this prop only controls presentation.
 */
export default function CallReportPage({ selfOnly = false }) {
  const { user } = useAuth();
  const [filters, setFilters] = useState(() => applyCallReportPreset('today'));
  const [executiveId, setExecutiveId] = useState(() => (selfOnly ? String(user?._id || '') : 'all'));
  // selfOnly: synthesize the one-item "team" from the already-authenticated user — no roster
  // fetch, since /sales-manager/executives isn't (and shouldn't be) authorized for this role.
  const [executives, setExecutives] = useState(() => (selfOnly && user ? [user] : []));
  // 'sales' | 'cold_calling' — which team the roster, Team Overview and team-wide analytics show.
  const [team, setTeam] = useState('sales');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('timeline');
  const [topTab, setTopTab] = useState('callReport');

  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const [pageIndex, setPageIndex] = useState(0);
  const [timeline, setTimeline] = useState({ events: [], pagination: null });
  const [timelineLoading, setTimelineLoading] = useState(false);

  const [teamRows, setTeamRows] = useState([]);
  const [teamLoading, setTeamLoading] = useState(false);

  const [selectedEvent, setSelectedEvent] = useState(null);

  useEffect(() => {
    if (selfOnly) return;
    setExecutives([]);
    const request = team === 'cold_calling'
      ? API.get('/sales-manager/call-report/team-members', { params: { team }, skipSuccessToast: true })
      : API.get('/sales-manager/executives', { skipSuccessToast: true });
    request.then((r) => setExecutives(r.data || []));
  }, [selfOnly, team]);

  const handleTeamChange = useCallback((next) => {
    setTeam(next);
    setExecutiveId('all');
    setSearch('');
  }, []);

  const fetchSummary = useCallback(() => {
    if (executiveId === 'all') return;
    setSummaryLoading(true);
    API.get('/sales-manager/call-report/summary', {
      params: { executiveId, dateFrom: filters.dateFrom, dateTo: filters.dateTo },
      skipSuccessToast: true,
    })
      .then((r) => setSummary(r.data))
      .finally(() => setSummaryLoading(false));
  }, [executiveId, filters.dateFrom, filters.dateTo]);

  const fetchTimeline = useCallback(() => {
    if (executiveId === 'all') return;
    setTimelineLoading(true);
    API.get('/sales-manager/call-report/timeline', {
      params: {
        executiveId,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        page: pageIndex + 1,
        limit: TIMELINE_PAGE_SIZE,
      },
      skipSuccessToast: true,
    })
      .then((r) => setTimeline(r.data))
      .finally(() => setTimelineLoading(false));
  }, [executiveId, filters.dateFrom, filters.dateTo, pageIndex]);

  const fetchTeamOverview = useCallback(() => {
    if (executiveId !== 'all') return;
    setTeamLoading(true);
    API.get('/sales-manager/call-report/team-overview', {
      params: { dateFrom: filters.dateFrom, dateTo: filters.dateTo, team },
      skipSuccessToast: true,
    })
      .then((r) => setTeamRows(r.data || []))
      .finally(() => setTeamLoading(false));
  }, [executiveId, filters.dateFrom, filters.dateTo, team]);

  useEffect(() => { setPageIndex(0); }, [executiveId, filters.dateFrom, filters.dateTo]);
  useEffect(() => { fetchSummary(); }, [fetchSummary]);
  useEffect(() => { fetchTimeline(); }, [fetchTimeline]);
  useEffect(() => { fetchTeamOverview(); }, [fetchTeamOverview]);

  useDataRefresh(['leads'], () => {
    fetchSummary();
    fetchTimeline();
    fetchTeamOverview();
  });

  const selectedExecutive = useMemo(
    () => (selfOnly ? user : executives.find((ex) => String(ex._id) === String(executiveId))),
    [executives, executiveId, selfOnly, user]
  );

  const filteredTeamRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teamRows;
    return teamRows.filter((row) => String(row.name || '').toLowerCase().includes(q));
  }, [teamRows, search]);

  const scopeLabel = useMemo(() => {
    const preset = activeCallReportPreset(filters);
    if (preset === 'today') return 'today';
    if (preset === 'yesterday') return 'yesterday';
    return filters.dateFrom === filters.dateTo ? filters.dateFrom : `${filters.dateFrom} → ${filters.dateTo}`;
  }, [filters]);

  const heroStats = useMemo(() => {
    if (executiveId === 'all') {
      const totalCalls = teamRows.reduce((s, r) => s + (r.totalCalls || 0), 0);
      const connected = teamRows.reduce((s, r) => s + (r.connectedCalls || 0), 0);
      const totalTalkTimeSec = teamRows.reduce((s, r) => s + (r.totalTalkTimeSec || 0), 0);
      return {
        totalCalls,
        totalConnected: connected,
        connectionRate: totalCalls ? Math.round((connected / totalCalls) * 1000) / 10 : 0,
        totalTalkTimeSec,
        activeExecutives: teamRows.filter((r) => r.totalCalls > 0).length,
      };
    }
    return {
      totalCalls: summary?.totalCalls || 0,
      totalConnected: summary?.connectedCalls || 0,
      connectionRate: summary?.totalCalls ? Math.round(((summary.connectedCalls || 0) / summary.totalCalls) * 1000) / 10 : 0,
      totalTalkTimeSec: summary?.totalTalkTimeSec || 0,
      activeExecutives: 1,
    };
  }, [executiveId, teamRows, summary]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={selfOnly ? 'My Call Report' : 'Call Report'}
        description={
          selfOnly
            ? 'Your chronological calling history, summary metrics, and daily target progress'
            : team === 'cold_calling'
              ? 'Chronological calling history, summary metrics, and analytics for every cold calling agent'
              : 'Chronological calling history, summary metrics, and analytics for every sales executive'
        }
        breadcrumbs={[
          selfOnly ? 'Sales Executive' : user?.role === 'admin' ? 'Admin' : 'Sales Manager',
          'Call Report',
        ]}
      />

      <CallReportHero
        totalCalls={heroStats.totalCalls}
        totalConnected={heroStats.totalConnected}
        connectionRate={heroStats.connectionRate}
        totalTalkTimeSec={heroStats.totalTalkTimeSec}
        activeExecutives={heroStats.activeExecutives}
        scopeLabel={scopeLabel}
      />

      <div className="flex items-center gap-1.5 rounded-xl border border-subtle bg-white p-1 w-fit dark:bg-slate-900/80">
        <button
          type="button"
          onClick={() => setTopTab('callReport')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            topTab === 'callReport' ? 'bg-violet-600 text-white shadow-sm' : 'text-content-muted hover:text-content-primary'
          }`}
        >
          <PhoneCall className="h-3.5 w-3.5" /> Call Report
        </button>
        <button
          type="button"
          onClick={() => setTopTab('executiveActivity')}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            topTab === 'executiveActivity' ? 'bg-violet-600 text-white shadow-sm' : 'text-content-muted hover:text-content-primary'
          }`}
        >
          <Activity className="h-3.5 w-3.5" /> Executive Activity
        </button>
      </div>

      {topTab === 'executiveActivity' ? (
        <ExecutiveActivityPage selfOnly={selfOnly} />
      ) : (
        <>
      <CallReportFilters
        filters={filters}
        onChange={setFilters}
        executives={executives}
        executiveId={executiveId}
        onExecutiveChange={setExecutiveId}
        search={search}
        onSearchChange={setSearch}
        team={team}
        onTeamChange={handleTeamChange}
        selfOnly={selfOnly}
      />

      {executiveId === 'all' ? (
        <div className="space-y-4">
          <TeamOverviewTable rows={filteredTeamRows} loading={teamLoading} onSelectExecutive={setExecutiveId} />

          <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50/60 to-white p-3.5 shadow-sm dark:bg-slate-900/80">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500 text-white">
                <BarChart3 className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-amber-700">{team === 'cold_calling' ? 'Cold Calling Analytics' : 'Team Analytics'}</h3>
                <p className="text-[11px] text-amber-600/80">Trends, peak hours, and executive comparisons</p>
              </div>
            </div>
            <AnalyticsSection executiveId="all" executives={executives} team={team} />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {!selfOnly && (
            <button
              type="button"
              onClick={() => setExecutiveId('all')}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-600 hover:text-violet-500"
            >
              <ArrowLeft className="h-4 w-4" /> Back to team overview
            </button>
          )}

          <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/60 to-white p-3.5 shadow-sm dark:bg-slate-900/80">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-white">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-emerald-700">
                  {selfOnly ? 'My Summary' : `${selectedExecutive?.name || 'Executive'} — Summary`}
                </h3>
                <p className="text-[11px] text-emerald-600/80">Key call metrics for the selected period</p>
              </div>
            </div>
            <ExecutiveSummaryCards
              summary={summary}
              loading={summaryLoading}
              executiveId={executiveId}
              executiveName={selectedExecutive?.name}
              dateFrom={filters.dateFrom}
              dateTo={filters.dateTo}
            />
          </div>

          <div className="flex items-center gap-1.5 rounded-xl border border-subtle bg-white p-1 w-fit dark:bg-slate-900/80">
            <button
              type="button"
              onClick={() => setTab('timeline')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                tab === 'timeline' ? 'bg-violet-600 text-white shadow-sm' : 'text-content-muted hover:text-content-primary'
              }`}
            >
              <ListTree className="h-3.5 w-3.5" /> Timeline
            </button>
            <button
              type="button"
              onClick={() => setTab('analytics')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                tab === 'analytics' ? 'bg-violet-600 text-white shadow-sm' : 'text-content-muted hover:text-content-primary'
              }`}
            >
              <Clock className="h-3.5 w-3.5" /> Analytics
            </button>
          </div>

          {tab === 'timeline' ? (
            <CallTimelineList
              events={timeline.events || []}
              pagination={timeline.pagination}
              pageIndex={pageIndex}
              onPageChange={setPageIndex}
              loading={timelineLoading}
              onSelectEvent={setSelectedEvent}
            />
          ) : (
            <AnalyticsSection executiveId={executiveId} executives={executives} team={team} />
          )}
        </div>
      )}

      <CallDetailDrawer event={selectedEvent} onClose={() => setSelectedEvent(null)} />
        </>
      )}
    </div>
  );
}
