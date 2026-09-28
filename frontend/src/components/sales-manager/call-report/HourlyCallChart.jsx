import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Clock4 } from 'lucide-react';
import API from '../../../api/axios';
import { ChartCard, EmptyChart } from './AnalyticsSection';
import HourCallDetailModal from './HourCallDetailModal';

const AXIS_LINE = { stroke: '#CBD5E1' };

/** "9 AM – 10 AM" style label for an hour-of-day bucket (0-23). */
export function formatHourRangeLabel(hour) {
  const label = (h) => {
    const period = h >= 12 ? 'PM' : 'AM';
    const display = h % 12 === 0 ? 12 : h % 12;
    return `${display} ${period}`;
  };
  return `${label(hour)} – ${label((hour + 1) % 24)}`;
}

function formatTime(at) {
  if (!at) return '—';
  return new Date(at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function HourTooltipContent({ active, payload, cache }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const preview = cache.get(row.hour);
  const calls = Array.isArray(preview) ? preview : null;

  return (
    <div className="max-w-[260px] rounded-xl border border-subtle bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900">
      <p className="text-xs font-bold text-content-primary">{row.label}</p>
      <p className="mt-0.5 text-[11px] font-semibold text-violet-600">Calls: {row.count}</p>
      {preview === 'loading' ? (
        <p className="mt-2 text-[11px] text-content-muted">Loading…</p>
      ) : calls?.length ? (
        <div className="mt-2 space-y-1.5">
          {calls.slice(0, 5).map((c) => (
            <div key={c.callId} className="border-t border-subtle/60 pt-1.5 first:border-t-0 first:pt-0">
              <p className="text-[11px] font-semibold tabular-nums text-content-primary">{formatTime(c.startedAt)}</p>
              <p className="text-[11px] text-content-secondary">{c.userName}</p>
              <p className="truncate text-[11px] text-content-secondary">
                {c.leadName}{c.leadPhone ? ` · ${c.leadPhone}` : ''}
              </p>
            </div>
          ))}
          {row.count > 5 && (
            <p className="pt-1.5 text-[10px] font-semibold text-violet-600">+ {row.count - 5} more calls</p>
          )}
        </div>
      ) : calls ? (
        <p className="mt-2 text-[11px] text-content-muted">No call details available</p>
      ) : null}
      <p className="mt-2 text-[10px] font-medium text-content-muted">Click bar for full details</p>
    </div>
  );
}

export default function HourlyCallChart({ rawByHour = [], dateFrom, dateTo, executiveId, executives = [], team = 'sales' }) {
  const chartData = useMemo(
    () => rawByHour.map((r) => ({ hour: r._id, count: r.count, label: formatHourRangeLabel(r._id) })),
    [rawByHour]
  );

  // Hover-preview cache: hour -> 'loading' | calls[]. A plain mutable Map (not state) so the
  // in-flight/at-rest value is always current when Recharts re-invokes the tooltip content on
  // mousemove; `tick` just forces a React re-render once a fetch resolves so a motionless cursor
  // still sees the update land.
  const cacheRef = useRef(new Map());
  const [, setTick] = useState(0);
  const debounceRef = useRef(null);
  const [selectedHour, setSelectedHour] = useState(null);

  useEffect(() => {
    cacheRef.current = new Map();
    setTick((n) => n + 1);
  }, [dateFrom, dateTo, executiveId, team]);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const fetchPreview = useCallback((hour) => {
    if (cacheRef.current.has(hour)) return;
    cacheRef.current.set(hour, 'loading');
    setTick((n) => n + 1);
    const params = { dateFrom, dateTo, hour, page: 1, limit: 5, team };
    if (executiveId && executiveId !== 'all') params.executiveId = executiveId;
    API.get('/sales-manager/call-report/hour-detail', { params, skipSuccessToast: true })
      .then((r) => cacheRef.current.set(hour, r.data?.calls || []))
      .catch(() => cacheRef.current.set(hour, []))
      .finally(() => setTick((n) => n + 1));
  }, [dateFrom, dateTo, executiveId, team]);

  const handleBarMouseEnter = useCallback((barData) => {
    const hour = barData?.hour;
    if (hour === undefined) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchPreview(hour), 150);
  }, [fetchPreview]);

  return (
    <ChartCard title="Calls by Hour" icon={Clock4} iconWrap="bg-violet-500">
      {chartData.length ? (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 14 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: '#64748B' }}
              axisLine={AXIS_LINE}
              tickLine={false}
              interval={0}
              angle={-25}
              textAnchor="end"
              height={36}
            />
            <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={AXIS_LINE} tickLine={false} allowDecimals={false} width={32} />
            <Tooltip cursor={{ fill: 'rgba(124,58,237,0.08)' }} content={<HourTooltipContent cache={cacheRef.current} />} />
            <Bar
              dataKey="count"
              name="Calls"
              fill="#7C3AED"
              radius={[6, 6, 0, 0]}
              maxBarSize={40}
              cursor="pointer"
              onMouseEnter={handleBarMouseEnter}
              onClick={(barData) => barData?.hour !== undefined && setSelectedHour(barData.hour)}
            />
          </BarChart>
        </ResponsiveContainer>
      ) : <EmptyChart />}

      <HourCallDetailModal
        open={selectedHour !== null}
        hour={selectedHour}
        dateFrom={dateFrom}
        dateTo={dateTo}
        initialExecutiveId={executiveId}
        executives={executives}
        team={team}
        onClose={() => setSelectedHour(null)}
      />
    </ChartCard>
  );
}
