import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import DashboardPanel from './DashboardPanel';

const COLORS = ['#7C3AED', '#6366F1', '#3B82F6', '#0EA5E9', '#14B8A6', '#F59E0B', '#94A3B8'];

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload || {};
  return (
    <div className="rounded-xl border border-subtle bg-surface px-3 py-2 text-sm shadow-lg">
      <p className="font-semibold text-content-primary">{row.name}</p>
      <p className="text-violet-600">
        {row.queries} leads · {row.pct}%
      </p>
    </div>
  );
}

export default function TopDestinationsDonut({ data = [] }) {
  const total = data.reduce((s, d) => s + Number(d.queries || 0), 0) || 1;
  const rows = data.slice(0, 6).map((d, i) => ({
    name: d.name,
    queries: Number(d.queries || 0),
    pct: Math.round((Number(d.queries || 0) / total) * 1000) / 10,
    color: COLORS[i % COLORS.length],
  }));
  if (rows.length && rows.reduce((s, r) => s + r.pct, 0) < 100) {
    const used = rows.reduce((s, r) => s + r.queries, 0);
    const others = Math.max(0, total - used);
    if (others > 0) {
      rows.push({
        name: 'Others',
        queries: others,
        pct: Math.round((others / total) * 1000) / 10,
        color: COLORS[COLORS.length - 1],
      });
    }
  }

  return (
    <DashboardPanel title="Top Destinations" subtitle="By Leads" className="h-full">
      <div className="flex flex-col items-center gap-3 sm:flex-row">
        <div className="h-[160px] w-full max-w-[180px] shrink-0">
          {rows.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={rows}
                  dataKey="queries"
                  nameKey="name"
                  innerRadius={48}
                  outerRadius={72}
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
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-content-muted">
              No data
            </div>
          )}
        </div>
        <div className="w-full min-w-0 space-y-1.5">
          {rows.map((row) => (
            <div key={row.name} className="flex items-center gap-2 text-sm">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: row.color }}
              />
              <span className="min-w-0 flex-1 truncate text-content-secondary">{row.name}</span>
              <span className="font-semibold tabular-nums text-content-primary">{row.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </DashboardPanel>
  );
}
