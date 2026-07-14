import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTheme } from '../../context/ThemeContext';
import DashboardPanel from './DashboardPanel';

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-subtle bg-surface px-3 py-2 text-sm shadow-lg">
      <p className="text-xs text-content-muted">{label}</p>
      <p className="font-bold text-blue-600">{payload[0].value}%</p>
    </div>
  );
}

export default function ConversionRateChart({ data = [] }) {
  const { isDark } = useTheme();
  const grid = isDark ? '#1f2937' : '#eef2f7';
  const tick = isDark ? '#64748b' : '#94a3b8';
  const latest = data[data.length - 1]?.rate;

  return (
    <DashboardPanel
      title="Conversion Rate Over Time"
      subtitle="Monthly conversion %"
      action={
        latest != null ? (
          <div className="text-right">
            <p className="text-lg font-bold text-blue-600 metric-tabular">{latest}%</p>
            <p className="text-[10px] text-content-muted">Latest</p>
          </div>
        ) : null
      }
      className="h-full"
    >
      <div className="h-[200px] -mx-1 sm:h-[240px]">
        {data.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="convRateGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: tick, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fill: tick, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={36}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="rate"
                stroke="#3B82F6"
                strokeWidth={2.5}
                fill="url(#convRateGrad)"
                dot={{ r: 3.5, fill: '#3B82F6', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className="flex h-full items-center justify-center text-sm text-content-muted">No conversion data</p>
        )}
      </div>
    </DashboardPanel>
  );
}
