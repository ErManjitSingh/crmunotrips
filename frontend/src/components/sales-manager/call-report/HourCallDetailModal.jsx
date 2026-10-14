import { useEffect, useMemo, useState } from 'react';
import { X, PhoneOff, Phone, Clock4, PhoneCall, Users2 } from 'lucide-react';
import AppModal from '../../ui/AppModal';
import TablePagination from '../../ui/TablePagination';
import API from '../../../api/axios';
import { formatCallDuration } from '../../../lib/callSession';
import { outcomeLabel, BUCKET_LABELS, BUCKET_STYLES } from '../../../lib/callOutcomeLabels';
import { formatHourRangeLabel } from './HourlyCallChart';

const PAGE_SIZE = 20;
const OUTCOME_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'connected', label: 'Connected' },
  { key: 'no_answer', label: 'No Answer' },
  { key: 'failed', label: 'Failed' },
];
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => h);

function formatDateLabel(dateFrom, dateTo) {
  if (!dateFrom) return '';
  const opts = { month: 'long', day: 'numeric', year: 'numeric' };
  const from = new Date(`${dateFrom}T00:00:00`).toLocaleDateString('en-US', opts);
  if (!dateTo || dateTo === dateFrom) return from;
  const to = new Date(`${dateTo}T00:00:00`).toLocaleDateString('en-US', opts);
  return `${from} – ${to}`;
}

export function formatTime(at) {
  if (!at) return '—';
  return new Date(at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function StatChip({ label, value, icon: Icon }) {
  return (
    <div className="rounded-xl border border-subtle bg-surface-elevated/50 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-content-muted">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </div>
      <p className="mt-0.5 text-base font-bold tabular-nums text-content-primary">{value}</p>
    </div>
  );
}

/** One call row: time, executive, guest/phone, duration + outcome, notes. Shared by every
 * Call Report drill-down that lists individual calls (Hour detail, KPI drill-downs). */
export function CallRow({ call: c }) {
  return (
    <div className="rounded-xl border border-subtle bg-white p-3 shadow-sm dark:bg-slate-900/80">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold tabular-nums text-content-primary">{formatTime(c.startedAt)}</p>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${BUCKET_STYLES[c.outcomeBucket] || BUCKET_STYLES.failed}`}>
          {BUCKET_LABELS[c.outcomeBucket] || 'Failed'}
        </span>
      </div>
      <p className="mt-1 text-sm font-semibold text-content-primary">{c.userName}</p>
      <p className="text-xs text-content-muted">
        {c.leadName}{c.leadPhone ? ` · ${c.leadPhone}` : ''}
      </p>
      <p className="mt-1 text-xs text-content-secondary">
        Duration: <span className="font-semibold tabular-nums">{formatCallDuration(c.duration || 0)}</span>
        {' · '}Outcome: <span className="font-semibold">{outcomeLabel(c.outcome)}</span>
      </p>
      {c.notes && <p className="mt-1 truncate text-xs text-content-muted">{c.notes}</p>}
    </div>
  );
}

export default function HourCallDetailModal({ open, hour, dateFrom, dateTo, initialExecutiveId, executives = [], team = 'sales', onClose }) {
  const [hourFilter, setHourFilter] = useState(hour);
  const [executiveId, setExecutiveId] = useState(initialExecutiveId || 'all');
  const [outcome, setOutcome] = useState('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [pageIndex, setPageIndex] = useState(0);

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  // Reset local filters to the clicked bar's context each time the modal opens for a (possibly new) hour.
  useEffect(() => {
    if (!open) return;
    setHourFilter(hour);
    setExecutiveId(initialExecutiveId || 'all');
    setOutcome('all');
    setSearch('');
    setDebouncedSearch('');
    setPageIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hour]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPageIndex(0); }, [hourFilter, executiveId, outcome, debouncedSearch]);

  useEffect(() => {
    if (!open || hourFilter == null) return;
    setLoading(true);
    const params = { dateFrom, dateTo, hour: hourFilter, page: pageIndex + 1, limit: PAGE_SIZE, team };
    if (executiveId && executiveId !== 'all') params.executiveId = executiveId;
    if (outcome && outcome !== 'all') params.outcome = outcome;
    if (debouncedSearch) params.search = debouncedSearch;
    API.get('/sales-manager/call-report/hour-detail', { params, skipSuccessToast: true })
      .then((r) => setResult(r.data))
      .finally(() => setLoading(false));
  }, [open, dateFrom, dateTo, hourFilter, executiveId, outcome, debouncedSearch, pageIndex, team]);

  const dateLabel = useMemo(() => formatDateLabel(dateFrom, dateTo), [dateFrom, dateTo]);
  const summary = result?.summary;
  const calls = result?.calls || [];

  return (
    <AppModal open={open} onClose={onClose} size="2xl">
      <div className="shrink-0 border-b border-subtle p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-violet-600">Call Details</p>
            <h2 className="mt-1 text-xl font-bold text-content-primary">
              {hourFilter != null ? formatHourRangeLabel(hourFilter) : ''}
            </h2>
            <p className="mt-0.5 text-xs text-content-muted">{dateLabel}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-content-muted hover:bg-surface-elevated">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          <StatChip label="Total Calls" value={summary?.totalCalls ?? '—'} icon={Phone} />
          <StatChip label="Connected" value={summary?.connectedCalls ?? '—'} icon={PhoneCall} />
          <StatChip label="No Answer" value={summary?.noAnswerCalls ?? '—'} icon={PhoneOff} />
          <StatChip label="Talk Time" value={summary ? formatCallDuration(summary.totalTalkTimeSec) : '—'} icon={Clock4} />
          <StatChip label="Executives" value={summary?.activeExecutives ?? '—'} icon={Users2} />
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-2">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-content-muted">
            Date
            <div className="mt-1 h-9 w-36 cursor-not-allowed rounded-lg border border-subtle bg-surface-elevated/60 px-2.5 text-xs font-medium leading-9 text-content-secondary">
              {dateFrom === dateTo ? 'Selected day' : 'Selected range'}
            </div>
          </label>
          <label className="text-[10px] font-semibold uppercase tracking-wide text-content-muted">
            Time
            <select
              value={hourFilter ?? ''}
              onChange={(e) => setHourFilter(Number(e.target.value))}
              className="mt-1 h-9 rounded-lg border border-subtle bg-white px-2 text-xs font-medium text-content-primary"
            >
              {HOUR_OPTIONS.map((h) => (
                <option key={h} value={h}>{formatHourRangeLabel(h)}</option>
              ))}
            </select>
          </label>
          <label className="text-[10px] font-semibold uppercase tracking-wide text-content-muted">
            {team === 'cold_calling' ? 'Cold Caller' : 'Sales Executive'}
            <select
              value={executiveId}
              onChange={(e) => setExecutiveId(e.target.value)}
              className="mt-1 h-9 min-w-[160px] rounded-lg border border-subtle bg-white px-2 text-xs font-medium text-content-primary"
            >
              <option value="all">All Executives</option>
              {executives.map((ex) => (
                <option key={ex._id} value={ex._id}>{ex.name}</option>
              ))}
            </select>
          </label>
          <label className="text-[10px] font-semibold uppercase tracking-wide text-content-muted">
            Outcome
            <select
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              className="mt-1 h-9 rounded-lg border border-subtle bg-white px-2 text-xs font-medium text-content-primary"
            >
              {OUTCOME_FILTERS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          </label>
          <label className="min-w-[160px] flex-1 text-[10px] font-semibold uppercase tracking-wide text-content-muted">
            Guest search
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search guest name or phone…"
              className="mt-1 h-9 w-full rounded-lg border border-subtle bg-white px-2.5 text-xs font-medium text-content-primary outline-none focus:border-violet-400"
            />
          </label>
        </div>
      </div>

      <div className="max-h-[420px] overflow-y-auto p-5">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-[84px] animate-pulse rounded-xl bg-surface-elevated/50" />
            ))}
          </div>
        ) : !calls.length ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-subtle bg-surface-elevated/40 py-14 text-center">
            <PhoneOff className="h-8 w-8 text-content-muted" />
            <p className="text-sm font-semibold text-content-primary">No calls in this hour</p>
            <p className="text-xs text-content-muted">Try a different executive, outcome, or hour</p>
          </div>
        ) : (
          <div className="space-y-2">
            {calls.map((c) => <CallRow key={c.callId} call={c} />)}
          </div>
        )}
      </div>

      {result?.pagination && calls.length > 0 && (
        <div className="border-t border-subtle">
          <TablePagination
            pageIndex={pageIndex}
            pageSize={result.pagination.limit}
            pageCount={result.pagination.totalPages || 1}
            total={result.pagination.total}
            onPageChange={setPageIndex}
            totalLabel="calls"
            accent="violet"
          />
        </div>
      )}
    </AppModal>
  );
}
