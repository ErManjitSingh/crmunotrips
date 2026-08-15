import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { ArrowRight } from 'lucide-react';
import { formatCurrency } from '../managerUtils';

function ChartCard({ title, children, delay, action }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm shadow-slate-200/50 min-h-[320px] flex flex-col"
    >
      <div className="flex items-center justify-between mb-4 gap-2">
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        {action}
      </div>
      <div className="flex-1 flex flex-col">{children}</div>
    </motion.div>
  );
}

export default function ManagerCharts({ data }) {
  const sources = data?.leadSources || [];
  const totalLeads = sources.reduce((s, x) => s + (x.value || 0), 0) || data?.kpis?.totalTeamLeads || 0;
  const weekRows =
    data?.teamRevenueWeek?.length > 0
      ? data.teamRevenueWeek
      : [
          { day: 'Mon', revenue: 0 },
          { day: 'Tue', revenue: 0 },
          { day: 'Wed', revenue: 0 },
          { day: 'Thu', revenue: 0 },
          { day: 'Fri', revenue: 0 },
          { day: 'Sat', revenue: 0 },
          { day: 'Sun', revenue: 0 },
        ];
  const weekTotal = weekRows.reduce((s, r) => s + (Number(r.revenue) || 0), 0);
  const top4 = sources.slice(0, 4);
  const restSources = sources.slice(4);
  const othersValue = restSources.reduce((s, x) => s + (x.value || 0), 0);
  const legendSources =
    othersValue > 0
      ? [...top4, { name: 'Others', value: othersValue, color: '#94A3B8' }]
      : sources.slice(0, 5);

  if (!data) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ChartCard title="Lead Sources" delay={0.08}>
        <div className="flex flex-col sm:flex-row items-center gap-5 flex-1">
          <div className="relative w-[210px] h-[210px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={legendSources.length ? legendSources : [{ name: 'None', value: 1, color: '#E2E8F0' }]}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={64}
                  outerRadius={92}
                  paddingAngle={legendSources.length > 1 ? 3 : 0}
                  stroke="none"
                >
                  {(legendSources.length ? legendSources : [{ color: '#E2E8F0' }]).map((e) => (
                    <Cell key={e.name} fill={e.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className="text-2xl font-bold text-slate-900 tabular-nums">{totalLeads}</p>
              <p className="text-[11px] font-medium text-slate-400">Total Leads</p>
            </div>
          </div>
          <div className="flex-1 w-full space-y-2.5">
            {legendSources.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-6">No source data yet</p>
            )}
            {legendSources.map((s) => {
              const pct = totalLeads ? ((s.value / totalLeads) * 100).toFixed(1) : 0;
              return (
                <div key={s.name} className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                  <span className="flex-1 text-sm text-slate-600 truncate">{s.name}</span>
                  <span className="text-sm font-semibold text-slate-800 tabular-nums">{pct}%</span>
                </div>
              );
            })}
            <Link
              to="/sales-manager/reports"
              className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-700 pt-2"
            >
              View Full Report <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </ChartCard>

      <ChartCard
        title="Team Revenue"
        delay={0.12}
        action={
          <span className="text-[11px] font-semibold text-slate-500 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-100">
            This Week
          </span>
        }
      >
        <div className="flex-1 min-h-[180px]">
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={weekRows} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="smRevFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7C3AED" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#7C3AED" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: '#94A3B8' }}
                axisLine={false}
                tickLine={false}
                width={36}
                tickFormatter={(v) => (v >= 100000 ? `${(v / 100000).toFixed(0)}L` : v === 0 ? '0' : `${v}`)}
              />
              <Tooltip
                formatter={(v) => [formatCurrency(v), 'Revenue']}
                contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0' }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#7C3AED"
                strokeWidth={2.5}
                fill="url(#smRevFill)"
                dot={{ r: 3.5, fill: '#7C3AED', strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-auto pt-4 border-t border-slate-100 grid grid-cols-3 gap-3">
          <div>
            <p className="text-[11px] font-medium text-slate-400">Total Revenue</p>
            <p className="text-sm font-bold text-slate-900 tabular-nums mt-0.5">{formatCurrency(weekTotal)}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-400">vs Last Week</p>
            <p className="text-sm font-bold text-slate-500 tabular-nums mt-0.5">—</p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-400">Target Achievement</p>
            <p className="text-sm font-bold text-slate-900 tabular-nums mt-0.5">0%</p>
          </div>
        </div>
      </ChartCard>
    </div>
  );
}
