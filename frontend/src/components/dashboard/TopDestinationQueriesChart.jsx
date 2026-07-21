import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { MapPin } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import DashboardPanel from './DashboardPanel';

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload || {};
  return (
    <div className="rounded-xl border border-subtle bg-surface px-3 py-2 text-sm shadow-lg">
      <p className="mb-1 font-semibold text-content-primary">{label}</p>
      <p className="text-violet-600">Queries: {row.queries || 0}</p>
      <p className="text-emerald-600">
        Converted: {row.conversions || 0} ({row.conversionRate || 0}%)
      </p>
    </div>
  );
}

export default function TopDestinationQueriesChart({ data = [] }) {
  const { isDark } = useTheme();
  const grid = isDark ? '#1f2937' : '#eef2f7';
  const tick = isDark ? '#94a3b8' : '#64748b';
  const rows = data.slice(0, 7);

  return (
    <DashboardPanel
      title="Top Destination Queries"
      subtitle="Most requested travel destinations"
      className="h-full"
      action={<MapPin className="h-4 w-4 text-violet-500" />}
    >
      <div className="h-[200px] -mx-1 sm:h-[240px]">
        {rows.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={rows}
              layout="vertical"
              margin={{ top: 4, right: 18, left: 8, bottom: 0 }}
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
                width={82}
                tick={{ fill: tick, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) =>
                  String(value).length > 12 ? `${String(value).slice(0, 11)}…` : value
                }
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(93,95,239,0.06)' }} />
              <Bar
                dataKey="queries"
                name="Queries"
                fill="#5D5FEF"
                radius={[0, 7, 7, 0]}
                barSize={18}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="flex h-full items-center justify-center text-sm text-content-muted">
            No destination queries yet
          </p>
        )}
      </div>
    </DashboardPanel>
  );
}
