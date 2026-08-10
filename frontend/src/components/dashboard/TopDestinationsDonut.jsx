import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import DashboardPanel from './DashboardPanel';

const COLORS = ['#7C3AED', '#059669', '#F97316', '#EC4899', '#0EA5E9', '#EAB308', '#94A3B8'];

function leadCount(row = {}) {
  return Number(row.queries ?? row.count ?? row.leads ?? row.value ?? 0);
}

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload || {};
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-lg">
      <p className="font-semibold text-slate-800">{row.name}</p>
      <p className="text-violet-600">
        {Number(row.queries || 0).toLocaleString('en-IN')} leads · {row.pct}%
      </p>
    </div>
  );
}

export default function TopDestinationsDonut({ data = [] }) {
  const normalized = (Array.isArray(data) ? data : [])
    .map((d) => ({
      name: String(d?.name || 'Unknown').trim() || 'Unknown',
      queries: leadCount(d),
    }))
    .filter((d) => d.queries > 0)
    .sort((a, b) => b.queries - a.queries);

  const total = normalized.reduce((s, d) => s + d.queries, 0);
  const top = normalized.slice(0, 5);
  const used = top.reduce((s, r) => s + r.queries, 0);
  const others = Math.max(0, total - used);

  const rows = top.map((d, i) => ({
    name: d.name,
    queries: d.queries,
    pct: total ? Math.round((d.queries / total) * 1000) / 10 : 0,
    color: COLORS[i % (COLORS.length - 1)],
  }));

  if (others > 0) {
    // Merge leftover with any existing "Other/Others" slice from rollup
    const otherIdx = rows.findIndex((r) => /^others?$/i.test(r.name));
    if (otherIdx >= 0) {
      rows[otherIdx] = {
        ...rows[otherIdx],
        queries: rows[otherIdx].queries + others,
        pct: total ? Math.round(((rows[otherIdx].queries + others) / total) * 1000) / 10 : 0,
        color: COLORS[COLORS.length - 1],
      };
    } else {
      rows.push({
        name: 'Others',
        queries: others,
        pct: total ? Math.round((others / total) * 1000) / 10 : 0,
        color: COLORS[COLORS.length - 1],
      });
    }
  }

  return (
    <DashboardPanel
      title="Top Destinations"
      subtitle="By leads in selected period"
      className="h-full"
    >
      {!rows.length ? (
        <div className="flex h-[220px] flex-col items-center justify-center gap-1 text-center">
          <p className="text-sm font-medium text-slate-500">No destinations in this period</p>
          <p className="text-xs text-slate-400">Try All Time or a wider date range</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div className="relative h-[168px] w-[168px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={rows}
                  dataKey="queries"
                  nameKey="name"
                  innerRadius={48}
                  outerRadius={74}
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {rows.map((row) => (
                    <Cell key={row.name} fill={row.color} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Leads
              </p>
              <p className="text-lg font-bold tabular-nums text-slate-900">
                {total.toLocaleString('en-IN')}
              </p>
            </div>
          </div>

          <ul className="w-full space-y-2">
            {rows.map((row) => (
              <li key={row.name} className="flex items-center gap-2 text-[12px]">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: row.color }}
                />
                <span className="min-w-0 flex-1 truncate font-medium text-slate-700" title={row.name}>
                  {row.name}
                </span>
                <span className="shrink-0 tabular-nums text-slate-500">{row.pct}%</span>
                <span className="w-10 shrink-0 text-right font-bold tabular-nums text-slate-900">
                  {row.queries.toLocaleString('en-IN')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </DashboardPanel>
  );
}
