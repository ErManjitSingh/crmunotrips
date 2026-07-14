import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTheme } from '../../context/ThemeContext';
import DashboardPanel from './DashboardPanel';

function formatLakhs(value) {
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(0)}K`;
  return `₹${value}`;
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-subtle bg-surface px-3 py-2 text-sm shadow-lg">
      <p className="mb-1 text-xs text-content-muted">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="font-semibold" style={{ color: p.color }}>
          {p.name}: {p.dataKey === 'revenue' ? formatLakhs(p.value) : p.value}
        </p>
      ))}
    </div>
  );
}

export default function RevenueVsBookingsChart({ data = [] }) {
  const { isDark } = useTheme();
  const grid = isDark ? '#1f2937' : '#eef2f7';
  const tick = isDark ? '#64748b' : '#94a3b8';

  return (
    <DashboardPanel title="Revenue vs Bookings" subtitle="Monthly bookings & revenue" className="h-full">
      <div className="h-[240px] -mx-1">
        {data.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: tick, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                yAxisId="left"
                tick={{ fill: tick, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={32}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fill: tick, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={44}
                tickFormatter={formatLakhs}
              />
              <Tooltip content={<ChartTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 12, paddingBottom: 8 }}
              />
              <Bar
                yAxisId="left"
                dataKey="bookings"
                name="Bookings"
                fill="#93C5FD"
                radius={[6, 6, 0, 0]}
                barSize={22}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="revenue"
                name="Revenue (₹)"
                stroke="#22C55E"
                strokeWidth={2.5}
                dot={{ r: 3.5, fill: '#22C55E', strokeWidth: 0 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <p className="flex h-full items-center justify-center text-sm text-content-muted">No revenue data</p>
        )}
      </div>
    </DashboardPanel>
  );
}
