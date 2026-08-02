import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Award, Trophy, Users } from 'lucide-react';
import Avatar from '../ui/Avatar';
import DashboardPanel from './DashboardPanel';
import { useTheme } from '../../context/ThemeContext';

const VISIBLE_ROWS = 7;

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload || {};
  return (
    <div className="rounded-xl border border-subtle bg-surface px-3 py-2 text-sm shadow-lg">
      <p className="mb-1 font-semibold text-content-primary">{row.name}</p>
      <p className="text-violet-600">Assigned: {row.assigned || 0}</p>
      <p className="text-emerald-600">Converted: {row.converted || 0}</p>
      <p className="font-semibold text-blue-600">{row.conversionRate || 0}% CR</p>
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
      <p className="mt-1 truncate text-sm font-bold tabular-nums leading-none metric-tabular sm:text-base">
        {value}
      </p>
    </div>
  );
}

function normalizeExecutive(exec) {
  const assigned = Number(exec.assigned ?? exec.assignedLeads ?? exec.leads ?? 0);
  const converted = Number(exec.converted ?? exec.conversions ?? 0);
  const conversionRate =
    exec.conversionRate != null
      ? Number(exec.conversionRate)
      : assigned
        ? Math.round((converted / assigned) * 1000) / 10
        : 0;
  return {
    _id: exec._id,
    name: exec.name || 'Unknown',
    assigned,
    converted,
    conversionRate,
    revenue: Number(exec.revenue || 0),
  };
}

export default function ExecutivePerformancePanel({ data }) {
  const { isDark } = useTheme();
  const grid = isDark ? '#1f2937' : '#eef2f7';
  const tick = isDark ? '#94a3b8' : '#64748b';

  const executives = (data?.executives || [])
    .map(normalizeExecutive)
    .sort((a, b) => b.converted - a.converted || b.conversionRate - a.conversionRate)
    .slice(0, VISIBLE_ROWS);

  const totalAssigned = executives.reduce((s, e) => s + e.assigned, 0);
  const totalConverted = executives.reduce((s, e) => s + e.converted, 0);
  const teamRate = totalAssigned
    ? Math.round((totalConverted / totalAssigned) * 1000) / 10
    : 0;
  const top = executives[0] || null;

  const chartRows = executives.map((e) => ({
    ...e,
    shortName:
      String(e.name).length > 10 ? `${String(e.name).slice(0, 9)}…` : e.name,
  }));

  return (
    <DashboardPanel
      title="Top Performing Executives"
      subtitle={
        top
          ? `Leader: ${top.name} · ${top.converted} converted · ${top.conversionRate}% CR`
          : 'Lead assignment & conversion'
      }
      action={
        <Link to="/leads/analytics" className="text-xs font-medium text-blue-600 hover:underline">
          View all
        </Link>
      }
      className="h-full"
    >
      {executives.length > 0 && (
        <div className="mb-3 grid grid-cols-3 gap-2">
          <StatChip
            icon={Trophy}
            label="Top"
            value={top?.name || '—'}
            tone="border-amber-100 bg-amber-50/80 text-amber-800"
          />
          <StatChip
            icon={Award}
            label="Team CR"
            value={`${teamRate}%`}
            tone="border-blue-100 bg-blue-50/80 text-blue-800"
          />
          <StatChip
            icon={Users}
            label="Converted"
            value={totalConverted.toLocaleString('en-IN')}
            tone="border-emerald-100 bg-emerald-50/80 text-emerald-800"
          />
        </div>
      )}

      <div className="h-[160px] -mx-1 sm:h-[180px]">
        {chartRows.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartRows}
              layout="vertical"
              margin={{ top: 4, right: 18, left: 4, bottom: 0 }}
              barCategoryGap="18%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke={grid} horizontal={false} />
              <XAxis
                type="number"
                allowDecimals={false}
                tick={{ fill: tick, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="shortName"
                width={72}
                tick={{ fill: tick, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(93,95,239,0.06)' }} />
              <Bar
                dataKey="converted"
                name="Converted"
                fill="#10B981"
                radius={[0, 6, 6, 0]}
                barSize={12}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="flex h-full items-center justify-center text-sm text-content-muted">
            No executive data
          </p>
        )}
      </div>

      {executives.length > 0 && (
        <ul className="mt-3 max-h-[140px] space-y-1.5 overflow-y-auto border-t border-subtle pt-3">
          {executives.map((exec, index) => (
            <li
              key={exec._id || exec.name}
              className="flex items-center justify-between gap-2 text-[11px] sm:text-xs"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
                    index === 0
                      ? 'bg-amber-100 text-amber-700'
                      : index === 1
                        ? 'bg-slate-100 text-slate-600'
                        : index === 2
                          ? 'bg-orange-50 text-orange-600'
                          : 'bg-slate-50 text-slate-500'
                  }`}
                >
                  {index + 1}
                </span>
                <Avatar name={exec.name} size="sm" className="!h-6 !w-6 shrink-0" />
                <span className="min-w-0 truncate font-medium text-content-primary" title={exec.name}>
                  {exec.name}
                </span>
              </div>
              <span className="shrink-0 tabular-nums text-content-secondary">
                <span className="text-violet-600">{exec.assigned} leads</span>
                <span className="mx-1 text-content-muted">·</span>
                <span className="font-semibold text-emerald-600">{exec.converted} conv</span>
                <span className="ml-1 font-bold text-blue-600">({exec.conversionRate}%)</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </DashboardPanel>
  );
}
