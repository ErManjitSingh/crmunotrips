import { useEffect, useMemo, useState } from 'react';
import { X, Phone, Users2, Trophy } from 'lucide-react';
import AppModal from '../../ui/AppModal';
import API from '../../../api/axios';
import { formatCallDuration } from '../../../lib/callSession';
import { StatChip } from './HourCallDetailModal';

function formatDateLabel(date) {
  if (!date) return '';
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export default function DayCallDetailModal({ open, date, initialExecutiveId, executives = [], team = 'sales', onClose }) {
  const [executiveId, setExecutiveId] = useState(initialExecutiveId || 'all');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Reset the filter to the outer page's context each time a (possibly new) day is opened.
  useEffect(() => {
    if (!open) return;
    setExecutiveId(initialExecutiveId || 'all');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, date]);

  useEffect(() => {
    if (!open || !date) return;
    setLoading(true);
    const params = { dateFrom: date, dateTo: date, team };
    if (executiveId && executiveId !== 'all') params.executiveId = executiveId;
    API.get('/sales-manager/call-report/analytics', { params, skipSuccessToast: true })
      .then((r) => setData(r.data))
      .finally(() => setLoading(false));
  }, [open, date, executiveId, team]);

  const byExecutive = useMemo(
    () => [...(data?.byExecutive || [])].sort((a, b) => b.calls - a.calls),
    [data]
  );
  const topCaller = byExecutive[0];
  const dateLabel = formatDateLabel(date);

  return (
    <AppModal open={open} onClose={onClose} size="xl">
      <div className="shrink-0 border-b border-subtle p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-blue-600">Calls by Executive</p>
            <h2 className="mt-1 text-xl font-bold text-content-primary">{dateLabel}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-content-muted hover:bg-surface-elevated">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <StatChip label="Total Calls" value={data?.totalCalls ?? '—'} icon={Phone} />
          <StatChip label="Executives Calling" value={byExecutive.length || '—'} icon={Users2} />
          <StatChip label="Top Caller" value={topCaller ? `${topCaller.name} — ${topCaller.calls}` : '—'} icon={Trophy} />
        </div>

        <label className="mt-4 block text-[10px] font-semibold uppercase tracking-wide text-content-muted">
          {team === 'cold_calling' ? 'Cold Caller' : 'Sales Executive'}
          <select
            value={executiveId}
            onChange={(e) => setExecutiveId(e.target.value)}
            className="mt-1 h-9 w-full max-w-[220px] rounded-lg border border-subtle bg-white px-2 text-xs font-medium text-content-primary"
          >
            <option value="all">All Executives</option>
            {executives.map((ex) => (
              <option key={ex._id} value={ex._id}>{ex.name}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="max-h-[420px] overflow-y-auto p-5">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-11 animate-pulse rounded-lg bg-surface-elevated/50" />
            ))}
          </div>
        ) : !byExecutive.length ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-subtle bg-surface-elevated/40 py-14 text-center">
            <Phone className="h-8 w-8 text-content-muted" />
            <p className="text-sm font-semibold text-content-primary">No calls on this day</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-subtle">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-blue-600">
                <tr>
                  {['Executive', 'Calls', 'Connected', 'Connection %', 'Talk Time'].map((h) => (
                    <th key={h} className="whitespace-nowrap px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-white">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-subtle">
                {byExecutive.map((ex) => {
                  const rate = ex.calls ? Math.round((ex.connected / ex.calls) * 1000) / 10 : 0;
                  return (
                    <tr key={ex.userId} className="bg-white dark:bg-slate-900/80">
                      <td className="whitespace-nowrap px-3 py-2.5 text-sm font-semibold text-content-primary">{ex.name}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-sm tabular-nums text-content-primary">{ex.calls}</td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-sm tabular-nums text-content-secondary">{ex.connected}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">{rate}%</span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-sm tabular-nums text-content-secondary">{formatCallDuration(ex.talkTime || 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-subtle bg-surface-elevated/60">
                  <td className="whitespace-nowrap px-3 py-2.5 text-sm font-bold text-content-primary">Total</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-sm font-bold tabular-nums text-content-primary">{data?.totalCalls ?? 0}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </AppModal>
  );
}
