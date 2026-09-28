import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList,
} from 'recharts';
import { BarChart3, Percent, Repeat2, Clock4, CalendarRange, Users, PhoneOff, CalendarDays } from 'lucide-react';
import API from '../../../api/axios';
import { formatDurationHuman } from '../../../lib/callSession';
import { CALL_REPORT_PRESETS, applyCallReportPreset, activeCallReportPreset } from './CallReportFilters';
import HourlyCallChart from './HourlyCallChart';
import DayCallDetailModal from './DayCallDetailModal';

const CALLS_RANGES = [
  { key: 'all', label: 'All', min: 0, max: Infinity },
  { key: '0-10', label: '0–10', min: 0, max: 10 },
  { key: '10-20', label: '10–20', min: 10, max: 20 },
  { key: '20-30', label: '20–30', min: 20, max: 30 },
  { key: '30-40', label: '30–40', min: 30, max: 40 },
  { key: '40-50', label: '40–50', min: 40, max: 50 },
  { key: '50+', label: '50+', min: 50, max: Infinity },
];

const SHOW_OPTIONS = [
  { key: '10', label: 'Top 10', n: 10 },
  { key: '20', label: 'Top 20', n: 20 },
  { key: 'all', label: 'All', n: Infinity },
];

const AXIS_LINE = { stroke: '#CBD5E1' };

const EXEC_ROW_HEIGHT = 26;
const EXEC_CARD_HEIGHT = 300;
const TALK_CHART_HEIGHT = 300;
const TALK_BAR_SLOT_WIDTH = 56;

function truncateName(name = '', max = 14) {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

function formatShortDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
}

function formatFullDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

function formatHourFull(hour) {
  const h = Number(hour);
  const period = h >= 12 ? 'PM' : 'AM';
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${String(display).padStart(2, '0')}:00 ${period}`;
}

function toInputDate(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

const ANALYTICS_PRESETS = [
  { key: 'today', label: 'Today', days: 0 },
  { key: '7d', label: '7 Days', days: 6 },
  { key: '30d', label: '30 Days', days: 29 },
];

function applyAnalyticsPreset(key) {
  const now = new Date();
  const preset = ANALYTICS_PRESETS.find((p) => p.key === key) || ANALYTICS_PRESETS[0];
  const from = new Date(now);
  from.setDate(from.getDate() - preset.days);
  return { dateFrom: toInputDate(from), dateTo: toInputDate(now) };
}

function formatHour(hour) {
  const h = Number(hour);
  const period = h >= 12 ? 'PM' : 'AM';
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}${period}`;
}

export function EmptyChart({ label = 'No calls in this period' }) {
  return (
    <div className="flex h-[220px] flex-col items-center justify-center gap-2 text-center">
      <PhoneOff className="h-6 w-6 text-content-muted" />
      <p className="text-xs font-medium text-content-muted">{label}</p>
    </div>
  );
}

function StatTile({ label, value, icon: Icon, iconWrap }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm shadow-slate-200/60 dark:bg-slate-900/80">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-content-muted">{label}</p>
        <div className={`inline-flex p-1.5 rounded-xl ${iconWrap}`}>
          <Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
        </div>
      </div>
      <p className="mt-1 text-xl font-bold tabular-nums text-content-primary">{value}</p>
    </div>
  );
}

export default function AnalyticsSection({ executiveId, executives = [], team = 'sales' }) {
  const [presetKey, setPresetKey] = useState('7d');
  const [customRange, setCustomRange] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [callsRange, setCallsRange] = useState('all');
  const [showLimit, setShowLimit] = useState('10');
  const [execFilters, setExecFilters] = useState(() => applyCallReportPreset('today'));
  const [execShowCustom, setExecShowCustom] = useState(false);
  const [execData, setExecData] = useState(null);
  const [execLoading, setExecLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);

  const range = customRange || applyAnalyticsPreset(presetKey);

  useEffect(() => {
    setLoading(true);
    const params = { dateFrom: range.dateFrom, dateTo: range.dateTo, team };
    if (executiveId && executiveId !== 'all') params.executiveId = executiveId;
    API.get('/sales-manager/call-report/analytics', { params, skipSuccessToast: true })
      .then((r) => setData(r.data))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.dateFrom, range.dateTo, executiveId, team]);

  // Calls by Executive keeps its own Today / Yesterday / Custom filter, independent of the
  // Today/7d/30d range above — managers usually want "who called who yesterday", not a rolling window.
  useEffect(() => {
    setExecLoading(true);
    const params = { dateFrom: execFilters.dateFrom, dateTo: execFilters.dateTo, team };
    if (executiveId && executiveId !== 'all') params.executiveId = executiveId;
    API.get('/sales-manager/call-report/analytics', { params, skipSuccessToast: true })
      .then((r) => setExecData(r.data))
      .finally(() => setExecLoading(false));
  }, [execFilters.dateFrom, execFilters.dateTo, executiveId, team]);

  const byDay = useMemo(
    () => (data?.byDay || []).map((r) => ({
      day: r._id,
      calls: r.calls,
      talkTime: Math.round(r.talkTime / 60),
      connectionRate: r.calls ? Math.round((r.connected / r.calls) * 1000) / 10 : 0,
    })),
    [data]
  );
  // Backend already sorts by calls desc; sort defensively so this chart never depends on upstream ordering.
  const byExecutive = useMemo(
    () => [...(execData?.byExecutive || [])].sort((a, b) => b.calls - a.calls),
    [execData]
  );

  const rangeFilteredExecutives = useMemo(() => {
    if (callsRange === 'all') return byExecutive;
    const r = CALLS_RANGES.find((x) => x.key === callsRange);
    if (!r) return byExecutive;
    return byExecutive.filter((e) => e.calls >= r.min && e.calls < r.max);
  }, [byExecutive, callsRange]);

  const displayedExecutives = useMemo(() => {
    const opt = SHOW_OPTIONS.find((o) => o.key === showLimit) || SHOW_OPTIONS[0];
    return rangeFilteredExecutives.slice(0, opt.n).map((e) => ({ ...e, displayName: truncateName(e.name) }));
  }, [rangeFilteredExecutives, showLimit]);

  const execChartHeight = Math.max(EXEC_ROW_HEIGHT * 3, displayedExecutives.length * EXEC_ROW_HEIGHT + 24);

  // "Today" has only one day of data — an hourly breakdown is more useful than a single daily bar.
  const isTodayView = !customRange && presetKey === 'today';
  const talkTimeChartData = useMemo(() => {
    if (isTodayView) {
      return (data?.byHour || []).map((r) => ({
        key: `h${r._id}`,
        label: formatHour(r._id),
        fullLabel: formatHourFull(r._id),
        talkTimeMin: Math.round((r.talkTime || 0) / 60),
      }));
    }
    return (data?.byDay || []).map((r) => ({
      key: r._id,
      label: formatShortDate(r._id),
      fullLabel: formatFullDate(r._id),
      talkTimeMin: Math.round((r.talkTime || 0) / 60),
    }));
  }, [data, isTodayView]);
  // Below this many bars, stretch to fill the card; beyond it, switch to a fixed width + horizontal scroll
  // so bars don't get squeezed into hairlines on a 30-day range.
  const TALK_SCROLL_THRESHOLD = 10;
  const talkNeedsScroll = talkTimeChartData.length > TALK_SCROLL_THRESHOLD;
  const talkChartWidth = talkTimeChartData.length * TALK_BAR_SLOT_WIDTH;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {ANALYTICS_PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => { setCustomRange(null); setPresetKey(p.key); }}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              !customRange && presetKey === p.key ? 'bg-violet-600 text-white shadow-sm' : 'bg-surface-elevated text-content-muted hover:text-content-primary'
            }`}
          >
            {p.label}
          </button>
        ))}
        <input
          type="date"
          value={customRange?.dateFrom || ''}
          onChange={(e) => setCustomRange({ dateFrom: e.target.value, dateTo: customRange?.dateTo || e.target.value })}
          className="h-8 rounded-lg border border-subtle bg-white px-2 text-xs"
        />
        <span className="text-xs text-content-muted">to</span>
        <input
          type="date"
          value={customRange?.dateTo || ''}
          onChange={(e) => setCustomRange({ dateFrom: customRange?.dateFrom || e.target.value, dateTo: e.target.value })}
          className="h-8 rounded-lg border border-subtle bg-white px-2 text-xs"
        />
      </div>

      {loading ? (
        <div className="h-64 animate-pulse rounded-xl border border-subtle bg-surface-elevated/50" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <StatTile label="Total Calls" value={data?.totalCalls ?? 0} icon={BarChart3} iconWrap="bg-sky-100 text-sky-600" />
            <StatTile label="Connection Rate" value={`${data?.connectionRateOverall ?? 0}%`} icon={Percent} iconWrap="bg-emerald-100 text-emerald-600" />
            <StatTile label="Avg Attempts / Guest" value={data?.avgAttemptsPerGuest ?? 0} icon={Repeat2} iconWrap="bg-fuchsia-100 text-fuchsia-600" />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <HourlyCallChart
              rawByHour={data?.byHour || []}
              dateFrom={range.dateFrom}
              dateTo={range.dateTo}
              executiveId={executiveId}
              executives={executives}
              team={team}
            />

            <ChartCard title="Calls by Day" icon={CalendarRange} iconWrap="bg-blue-500">
              {byDay.length ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={byDay} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#64748B' }} axisLine={AXIS_LINE} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={AXIS_LINE} tickLine={false} allowDecimals={false} width={32} />
                    <Tooltip contentStyle={{ borderRadius: 12 }} cursor={{ fill: 'rgba(37,99,235,0.08)' }} />
                    <Bar
                      dataKey="calls"
                      name="Calls"
                      fill="#2563EB"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={40}
                      cursor="pointer"
                      onClick={(barData) => barData?.day && setSelectedDay(barData.day)}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </ChartCard>
          </div>

          <DayCallDetailModal
            open={selectedDay !== null}
            date={selectedDay}
            initialExecutiveId={executiveId}
            executives={executives}
            team={team}
            onClose={() => setSelectedDay(null)}
          />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard title={isTodayView ? 'Talk Time by Hour' : 'Talk Time by Day'} icon={Clock4} iconWrap="bg-emerald-500">
              {!talkTimeChartData.length ? (
                <EmptyChart label="No talk-time data available for this period." />
              ) : (
                (() => {
                  const chart = (
                    <BarChart data={talkTimeChartData} margin={{ top: 24, right: 12, left: 0, bottom: 4 }} barCategoryGap="20%">
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={AXIS_LINE} tickLine={false} interval={0} />
                      <YAxis tick={false} axisLine={AXIS_LINE} tickLine={false} width={1} domain={[0, (max) => Math.ceil((max || 1) * 1.25) + 1]} />
                      <Tooltip
                        cursor={{ fill: 'rgba(5,150,105,0.06)' }}
                        contentStyle={{ borderRadius: 10, fontSize: 12 }}
                        formatter={(value) => [formatDurationHuman(value * 60), 'Talk time']}
                        labelFormatter={(_, payload) => payload?.[0]?.payload?.fullLabel || ''}
                      />
                      <Bar dataKey="talkTimeMin" name="Talk time" fill="#059669" radius={[8, 8, 0, 0]} maxBarSize={48}>
                        <LabelList
                          dataKey="talkTimeMin"
                          position="top"
                          formatter={(v) => (v > 0 ? formatDurationHuman(v * 60) : '')}
                          style={{ fill: '#065F46', fontSize: 11, fontWeight: 700 }}
                        />
                      </Bar>
                    </BarChart>
                  );
                  return talkNeedsScroll ? (
                    <div className="overflow-x-auto">
                      <div style={{ width: talkChartWidth, height: TALK_CHART_HEIGHT }}>
                        <ResponsiveContainer width="100%" height="100%">{chart}</ResponsiveContainer>
                      </div>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={TALK_CHART_HEIGHT}>{chart}</ResponsiveContainer>
                  );
                })()
              )}
            </ChartCard>

            <ChartCard
              title="Calls by Executive"
              icon={Users}
              iconWrap="bg-amber-500"
              headerRight={
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1">
                  {CALL_REPORT_PRESETS.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => { setExecShowCustom(false); setExecFilters(applyCallReportPreset(p.key)); }}
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                        !execShowCustom && activeCallReportPreset(execFilters) === p.key
                          ? 'bg-amber-500 text-white shadow-sm'
                          : 'bg-surface-elevated text-content-muted hover:text-content-primary'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setExecShowCustom((v) => !v)}
                    className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                      execShowCustom || activeCallReportPreset(execFilters) === 'custom'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-surface-elevated text-content-muted hover:text-content-primary'
                    }`}
                  >
                    <CalendarDays className="h-3.5 w-3.5" />
                    Custom
                  </button>
                </div>
                {(execShowCustom || activeCallReportPreset(execFilters) === 'custom') && (
                  <div className="flex items-center gap-1">
                    <input
                      type="date"
                      value={execFilters.dateFrom || ''}
                      onChange={(e) => setExecFilters({ ...execFilters, dateFrom: e.target.value })}
                      className="h-8 rounded-lg border border-subtle bg-white px-2 text-xs"
                    />
                    <span className="text-xs text-content-muted">to</span>
                    <input
                      type="date"
                      value={execFilters.dateTo || ''}
                      onChange={(e) => setExecFilters({ ...execFilters, dateTo: e.target.value })}
                      className="h-8 rounded-lg border border-subtle bg-white px-2 text-xs"
                    />
                  </div>
                )}
                <label className="flex items-center gap-1.5 text-xs font-medium text-content-muted">
                  Calls:
                  <select
                    value={callsRange}
                    onChange={(e) => setCallsRange(e.target.value)}
                    className="h-8 rounded-lg border border-subtle bg-white px-2 text-xs font-semibold text-content-primary"
                  >
                    {CALLS_RANGES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-1.5 text-xs font-medium text-content-muted">
                  Show:
                  <select
                    value={showLimit}
                    onChange={(e) => setShowLimit(e.target.value)}
                    className="h-8 rounded-lg border border-subtle bg-white px-2 text-xs font-semibold text-content-primary"
                  >
                    {SHOW_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                  </select>
                </label>
              </div>
            }
          >
            {execLoading ? (
              <div className="h-[220px] animate-pulse rounded-xl bg-surface-elevated/50" />
            ) : !byExecutive.length ? (
              <EmptyChart />
            ) : !displayedExecutives.length ? (
              <EmptyChart label="No executives found for this call range." />
            ) : (
              <div style={{ maxHeight: EXEC_CARD_HEIGHT }} className="overflow-y-auto">
                <ResponsiveContainer width="100%" height={execChartHeight}>
                  <BarChart data={displayedExecutives} layout="vertical" margin={{ top: 4, right: 28, left: 4, bottom: 4 }} barCategoryGap={8}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#EEF2F6" />
                    <XAxis type="number" tick={false} axisLine={AXIS_LINE} tickLine={false} height={1} domain={[0, (max) => Math.ceil(max * 1.15) + 1]} />
                    <YAxis
                      type="category"
                      dataKey="displayName"
                      width={88}
                      tick={{ fontSize: 11, fill: '#334155', fontWeight: 500 }}
                      axisLine={AXIS_LINE}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(245,158,11,0.06)' }}
                      contentStyle={{ borderRadius: 10, fontSize: 12 }}
                      formatter={(value) => [value, 'Calls']}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.name || ''}
                    />
                    <Bar dataKey="calls" name="Calls" fill="#F59E0B" radius={[0, 8, 8, 0]} barSize={EXEC_ROW_HEIGHT - 8}>
                      <LabelList dataKey="calls" position="right" style={{ fill: '#92400E', fontSize: 11, fontWeight: 700 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}

export function ChartCard({ title, icon: Icon, iconWrap, headerRight, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {Icon && (
            <div className={`flex h-7 w-7 items-center justify-center rounded-lg text-white ${iconWrap}`}>
              <Icon className="h-3.5 w-3.5" />
            </div>
          )}
          <h3 className="text-sm font-bold text-content-primary">{title}</h3>
        </div>
        {headerRight}
      </div>
      {children}
    </motion.div>
  );
}
