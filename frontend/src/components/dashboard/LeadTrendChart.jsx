import {
  Line,
  LineChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
  LabelList,
} from 'recharts';
import { useTheme } from '../../context/ThemeContext';
import DashboardPanel from './DashboardPanel';

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-subtle bg-surface px-3 py-2 text-sm shadow-lg">
      <p className="mb-1 text-xs text-content-muted">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="font-semibold" style={{ color: p.color }}>
          {p.name}: {p.value?.toLocaleString('en-IN')}
        </p>
      ))}
    </div>
  );
}

export default function LeadTrendChart({ stats }) {
  const { isDark } = useTheme();
  const data = stats?.report?.monthlyLeadTrend || [];
  const grid = isDark ? '#1f2937' : '#eef2f7';
  const tick = isDark ? '#64748b' : '#94a3b8';

  return (
    <DashboardPanel
      title="Monthly Lead Trend"
      subtitle="Generated · Connected · Converted"
      action={
        <span className="rounded-full border border-subtle bg-surface-elevated/60 px-2.5 py-1 text-[11px] font-medium text-content-muted">
          From July
        </span>
      }
      className="h-full"
    >
      <div className="h-[220px] -mx-1 sm:h-[260px] lg:h-[280px]">
        {data.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 16, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: tick, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: tick, fontSize: 10 }} axisLine={false} tickLine={false} width={36} />
              <Tooltip content={<ChartTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 12, paddingBottom: 8 }}
              />
              <Line
                type="monotone"
                dataKey="leadsGenerated"
                name="Leads Generated"
                stroke="#3B82F6"
                strokeWidth={2.75}
                dot={{ r: 3, fill: '#3B82F6', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              >
                <LabelList
                  dataKey="leadsGenerated"
                  position="top"
                  className="hidden sm:block"
                  style={{ fill: tick, fontSize: 10 }}
                />
              </Line>
              <Line
                type="monotone"
                dataKey="connectedLeads"
                name="Connected Leads"
                stroke="#F59E0B"
                strokeWidth={2.75}
                dot={{ r: 3, fill: '#F59E0B', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              >
                <LabelList
                  dataKey="connectedLeads"
                  position="top"
                  className="hidden sm:block"
                  style={{ fill: tick, fontSize: 10 }}
                />
              </Line>
              <Line
                type="monotone"
                dataKey="convertedLeads"
                name="Converted Leads"
                stroke="#22C55E"
                strokeWidth={2.75}
                dot={{ r: 3, fill: '#22C55E', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              >
                <LabelList
                  dataKey="convertedLeads"
                  position="top"
                  className="hidden sm:block"
                  style={{ fill: tick, fontSize: 10 }}
                />
              </Line>
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="flex h-full items-center justify-center text-sm text-content-muted">No trend data yet</p>
        )}
      </div>
    </DashboardPanel>
  );
}
