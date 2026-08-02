import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Percent, TrendingUp, Trophy, Users } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import DashboardPanel from './DashboardPanel';

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload || {};
  return (
    <div className="rounded-xl border border-subtle bg-surface px-3 py-2 text-sm shadow-lg">
      <p className="mb-1.5 font-semibold text-content-primary">{label}</p>
      <p className="text-blue-600 font-semibold">{Number(row.rate || 0)}% conversion</p>
      <p className="text-violet-600">Leads: {Number(row.leads || 0).toLocaleString('en-IN')}</p>
      <p className="text-amber-600">Connected: {Number(row.connected || 0).toLocaleString('en-IN')}</p>
      <p className="text-emerald-600">Converted: {Number(row.converted || 0).toLocaleString('en-IN')}</p>
    </div>
  );
}

function StatChip({ icon: Icon, label, value, tone, suffix = '' }) {
  return (
    <div className={`rounded-xl border px-2.5 py-2 ${tone}`}>
      <div className="flex items-center gap-1.5">
        <Icon className="h-3 w-3 shrink-0 opacity-80" />
        <span className="truncate text-[9px] font-bold uppercase tracking-wide opacity-80">{label}</span>
      </div>
      <p className="mt-1 text-base font-bold tabular-nums leading-none metric-tabular">
        {value}
        {suffix}
      </p>
    </div>
  );
}

export default function ConversionRateChart({ data = [] }) {
  const { isDark } = useTheme();
  const grid = isDark ? '#1f2937' : '#eef2f7';
  const tick = isDark ? '#94a3b8' : '#64748b';

  const rows = Array.isArray(data) ? data : [];
  const withLeads = rows.filter((r) => Number(r.leads) > 0);
  const totalLeads = rows.reduce((s, r) => s + (Number(r.leads) || 0), 0);
  const totalConverted = rows.reduce((s, r) => s + (Number(r.converted) || 0), 0);
  const overallRate = totalLeads
    ? Math.round((totalConverted / totalLeads) * 1000) / 10
    : 0;
  const latest = [...rows].reverse().find((r) => Number(r.leads) > 0) || rows[rows.length - 1];
  const best = withLeads.length
    ? withLeads.reduce((a, b) => (Number(b.rate) > Number(a.rate) ? b : a))
    : null;

  return (
    <DashboardPanel
      title="Conversion Rate Over Time"
      subtitle={
        latest
          ? `From July · Latest: ${latest.label} · ${Number(latest.rate || 0)}%`
          : 'Monthly conversion % from July'
      }
      action={<Percent className="h-4 w-4 text-blue-500" />}
      className="h-full"
    >
      {rows.length > 0 && (
        <div className="mb-3 grid grid-cols-3 gap-2">
          <StatChip
            icon={TrendingUp}
            label="Overall"
            value={overallRate}
            suffix="%"
            tone="border-blue-100 bg-blue-50/80 text-blue-800"
          />
          <StatChip
            icon={Trophy}
            label="Best"
            value={best ? Number(best.rate || 0) : 0}
            suffix="%"
            tone="border-emerald-100 bg-emerald-50/80 text-emerald-800"
          />
          <StatChip
            icon={Users}
            label="Converted"
            value={Number(totalConverted).toLocaleString('en-IN')}
            tone="border-violet-100 bg-violet-50/80 text-violet-800"
          />
        </div>
      )}

      <div className="h-[180px] -mx-1 sm:h-[200px]">
        {rows.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 8, right: 8, left: -8, bottom: 0 }} barCategoryGap="22%">
              <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: tick, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: tick, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={36}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(59,130,246,0.06)' }} />
              <Bar
                dataKey="rate"
                name="Conversion %"
                fill="#3B82F6"
                radius={[5, 5, 0, 0]}
                barSize={16}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="flex h-full items-center justify-center text-sm text-content-muted">
            No conversion data yet
          </p>
        )}
      </div>

      {rows.length > 0 && (
        <ul className="mt-3 max-h-[120px] space-y-1.5 overflow-y-auto border-t border-subtle pt-3">
          {[...rows].reverse().map((row) => (
            <li
              key={row.label || row.month}
              className="flex items-center justify-between gap-2 text-[11px] sm:text-xs"
            >
              <span className="min-w-0 truncate font-medium text-content-primary">
                {row.label || row.month}
              </span>
              <span className="shrink-0 tabular-nums text-content-secondary">
                <span className="font-semibold text-blue-600">{Number(row.rate || 0)}%</span>
                <span className="mx-1 text-content-muted">·</span>
                <span className="text-violet-600">{Number(row.leads || 0)} leads</span>
                <span className="mx-1 text-content-muted">·</span>
                <span className="font-semibold text-emerald-600">
                  {Number(row.converted || 0)} conv
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </DashboardPanel>
  );
}
