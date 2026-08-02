import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TrendingUp, Users, Phone, Trophy } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import DashboardPanel from './DashboardPanel';

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload || {};
  return (
    <div className="rounded-xl border border-subtle bg-surface px-3 py-2 text-sm shadow-lg">
      <p className="mb-1.5 font-semibold text-content-primary">{label}</p>
      <p className="text-violet-600">Generated: {Number(row.leadsGenerated || 0).toLocaleString('en-IN')}</p>
      <p className="text-amber-600">Connected: {Number(row.connectedLeads || 0).toLocaleString('en-IN')}</p>
      <p className="text-emerald-600">Converted: {Number(row.convertedLeads || 0).toLocaleString('en-IN')}</p>
    </div>
  );
}

function StatChip({ icon: Icon, label, value, tone }) {
  return (
    <div className={`rounded-xl border px-2.5 py-2 ${tone}`}>
      <div className="flex items-center gap-1.5">
        <Icon className="h-3 w-3 shrink-0 opacity-80" />
        <span className="truncate text-[9px] font-bold uppercase tracking-wide opacity-80">{label}</span>
      </div>
      <p className="mt-1 text-base font-bold tabular-nums leading-none metric-tabular">
        {Number(value || 0).toLocaleString('en-IN')}
      </p>
    </div>
  );
}

export default function LeadTrendChart({ stats }) {
  const { isDark } = useTheme();
  const data = stats?.report?.monthlyLeadTrend || [];
  const grid = isDark ? '#1f2937' : '#eef2f7';
  const tick = isDark ? '#94a3b8' : '#64748b';

  const rows = Array.isArray(data) ? data : [];
  const totalGenerated = rows.reduce((s, r) => s + (Number(r.leadsGenerated) || 0), 0);
  const totalConnected = rows.reduce((s, r) => s + (Number(r.connectedLeads) || 0), 0);
  const totalConverted = rows.reduce((s, r) => s + (Number(r.convertedLeads) || 0), 0);
  const latest = rows[rows.length - 1];

  return (
    <DashboardPanel
      title="Monthly Lead Trend"
      subtitle={
        latest
          ? `From July · Latest: ${latest.label} · ${Number(latest.leadsGenerated || 0).toLocaleString('en-IN')} generated`
          : 'Generated · Connected · Converted from July'
      }
      action={<TrendingUp className="h-4 w-4 text-violet-500" />}
      className="h-full"
    >
      {rows.length > 0 && (
        <div className="mb-3 grid grid-cols-3 gap-2">
          <StatChip
            icon={Users}
            label="Generated"
            value={totalGenerated}
            tone="border-violet-100 bg-violet-50/80 text-violet-800"
          />
          <StatChip
            icon={Phone}
            label="Connected"
            value={totalConnected}
            tone="border-amber-100 bg-amber-50/80 text-amber-800"
          />
          <StatChip
            icon={Trophy}
            label="Converted"
            value={totalConverted}
            tone="border-emerald-100 bg-emerald-50/80 text-emerald-800"
          />
        </div>
      )}

      <div className="h-[200px] -mx-1 sm:h-[220px]">
        {rows.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={rows}
              margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
              barGap={2}
              barCategoryGap="22%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: tick, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: tick, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={32}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(93,95,239,0.06)' }} />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 11, paddingBottom: 6 }}
              />
              <Bar
                dataKey="leadsGenerated"
                name="Generated"
                fill="#5D5FEF"
                radius={[5, 5, 0, 0]}
                barSize={12}
              />
              <Bar
                dataKey="connectedLeads"
                name="Connected"
                fill="#F59E0B"
                radius={[5, 5, 0, 0]}
                barSize={12}
              />
              <Bar
                dataKey="convertedLeads"
                name="Converted"
                fill="#10B981"
                radius={[5, 5, 0, 0]}
                barSize={12}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="flex h-full items-center justify-center text-sm text-content-muted">
            No trend data yet
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
                <span className="text-violet-600">{Number(row.leadsGenerated || 0)} generated</span>
                <span className="mx-1 text-content-muted">·</span>
                <span className="text-amber-600">{Number(row.connectedLeads || 0)} connected</span>
                <span className="mx-1 text-content-muted">·</span>
                <span className="font-semibold text-emerald-600">
                  {Number(row.convertedLeads || 0)} converted
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </DashboardPanel>
  );
}
