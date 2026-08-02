import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PieChart } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import DashboardPanel from './DashboardPanel';

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload || {};
  return (
    <div className="rounded-xl border border-subtle bg-surface px-3 py-2 text-sm shadow-lg">
      <p className="mb-1 font-semibold text-content-primary">{label}</p>
      <p className="text-violet-600">Leads: {row.leads || 0}</p>
    </div>
  );
}

export default function LeadStatusDonut({ data = [], total = 0, summary = null }) {
  const { isDark } = useTheme();
  const grid = isDark ? '#1f2937' : '#eef2f7';
  const tick = isDark ? '#94a3b8' : '#64748b';

  const rows = (Array.isArray(data) ? data : [])
    .map((d) => ({
      name: d.name,
      key: d.key || d.name,
      leads: Number(d.value) || 0,
      color: d.color || '#5D5FEF',
    }))
    .filter((d) => d.leads > 0)
    .sort((a, b) => b.leads - a.leads)
    .slice(0, 8);

  const sumValues = rows.reduce((s, d) => s + d.leads, 0);
  const displayTotal = Number(summary?.total ?? summary?.arrived ?? total ?? sumValues) || 0;
  const connected = Number(summary?.connected ?? 0);
  const periodLabel = summary?.periodLabel || 'Selected period';
  const top = rows[0];

  return (
    <DashboardPanel
      title="Lead Status Distribution"
      subtitle={
        top
          ? `${periodLabel} · ${Number(displayTotal).toLocaleString('en-IN')} leads · ${connected.toLocaleString('en-IN')} connected`
          : `${periodLabel} · every lead counted once`
      }
      className="h-full"
      action={<PieChart className="h-4 w-4 text-violet-500" />}
    >
      <div className="h-[180px] -mx-1 sm:h-[200px]">
        {rows.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={rows}
              layout="vertical"
              margin={{ top: 4, right: 18, left: 8, bottom: 0 }}
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
                dataKey="name"
                width={96}
                tick={{ fill: tick, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) =>
                  String(value).length > 14 ? `${String(value).slice(0, 13)}…` : value
                }
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(93,95,239,0.06)' }} />
              <Bar
                dataKey="leads"
                name="Leads"
                radius={[0, 6, 6, 0]}
                barSize={12}
              >
                {rows.map((row) => (
                  <Cell key={row.key} fill={row.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="flex h-full items-center justify-center text-sm text-content-muted">
            No leads in this period
          </p>
        )}
      </div>

      {rows.length > 0 && (
        <ul className="mt-3 max-h-[120px] space-y-1.5 overflow-y-auto border-t border-subtle pt-3">
          {rows.map((row) => (
            <li
              key={row.key}
              className="flex items-center justify-between gap-2 text-[11px] sm:text-xs"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: row.color }}
                />
                <span className="min-w-0 truncate font-medium text-content-primary" title={row.name}>
                  {row.name}
                </span>
              </span>
              <span className="shrink-0 tabular-nums font-semibold text-violet-600">
                {row.leads} leads
              </span>
            </li>
          ))}
        </ul>
      )}
    </DashboardPanel>
  );
}
