import { useMemo } from 'react';
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
import { Wallet, MessageCircle } from 'lucide-react';
import { formatCurrency } from '../managerUtils';

const SOURCE_ICON = {
  whatsapp: MessageCircle,
};

function ChartCard({ title, children, delay, action }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm shadow-slate-200/50"
    >
      <div className="flex items-center justify-between mb-4 gap-2">
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        {action}
      </div>
      {children}
    </motion.div>
  );
}

function PeriodPill({ label = 'This Week' }) {
  return (
    <span className="text-[11px] font-semibold text-slate-500 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-100">
      {label}
    </span>
  );
}

function initials(name) {
  return String(name || '?')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function avatarTone(i) {
  const tones = [
    'from-violet-500 to-indigo-600',
    'from-sky-500 to-blue-600',
    'from-emerald-500 to-teal-600',
    'from-amber-500 to-orange-600',
    'from-rose-500 to-pink-600',
  ];
  return tones[i % tones.length];
}

export default function ManagerCharts({ data }) {
  const sources = data?.leadSources || [];
  const totalLeads = sources.reduce((s, x) => s + (x.value || 0), 0) || data?.kpis?.totalTeamLeads || 0;
  const revenueRows = data?.teamRevenueChart || [];
  const hasRevenue = revenueRows.some((r) => Number(r.revenue) > 0);
  const conversion = data?.monthlyConversion?.length
    ? data.monthlyConversion
    : [
        { month: 'Jan', rate: 0 },
        { month: 'Feb', rate: 0 },
        { month: 'Mar', rate: 0 },
        { month: 'Apr', rate: 0 },
        { month: 'May', rate: 0 },
        { month: 'Jun', rate: 0 },
        { month: 'Jul', rate: data?.kpis?.conversionRate || 0 },
      ];

  const execRows = useMemo(() => {
    const rows = [...(data?.executivePerformance || [])];
    return rows
      .map((ex) => ({
        ...ex,
        conversionRate: ex.leads ? Math.round((ex.conversions / ex.leads) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.leads - a.leads)
      .slice(0, 6);
  }, [data?.executivePerformance]);

  if (!data) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ChartCard title="Lead Sources" delay={0.08}>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="relative w-[200px] h-[200px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sources.length ? sources : [{ name: 'None', value: 1, color: '#E2E8F0' }]}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={62}
                  outerRadius={88}
                  paddingAngle={sources.length > 1 ? 3 : 0}
                  stroke="none"
                >
                  {(sources.length ? sources : [{ color: '#E2E8F0' }]).map((e) => (
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
            {sources.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-6">No source data yet</p>
            )}
            {sources.map((s) => {
              const pct = totalLeads ? ((s.value / totalLeads) * 100).toFixed(1) : 0;
              const key = String(s.name || '').toLowerCase();
              const Icon = SOURCE_ICON[key];
              return (
                <div key={s.name} className="flex items-center gap-2.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: s.color }}
                  />
                  <span className="flex-1 text-sm text-slate-600 truncate flex items-center gap-1.5">
                    {Icon ? <Icon className="w-3.5 h-3.5 text-teal-500" /> : null}
                    {s.name}
                  </span>
                  <span className="text-sm font-semibold text-slate-800 tabular-nums">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </ChartCard>

      <ChartCard title="Team Revenue" delay={0.12} action={<PeriodPill />}>
        {hasRevenue ? (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={revenueRows} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="smRevFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7C3AED" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#7C3AED" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: '#94A3B8' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `₹${v / 100000}L`}
              />
              <Tooltip
                formatter={(v) => [formatCurrency(v), 'Revenue']}
                contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0' }}
              />
              <Area type="monotone" dataKey="revenue" stroke="#7C3AED" strokeWidth={2.5} fill="url(#smRevFill)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[220px] flex flex-col items-center justify-center text-center px-4">
            <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-3">
              <Wallet className="w-7 h-7 text-slate-300" />
            </div>
            <p className="text-sm font-semibold text-slate-600">No revenue data available</p>
            <p className="text-xs text-slate-400 mt-1 max-w-[220px]">
              Approved package conversions will appear here this week.
            </p>
          </div>
        )}
      </ChartCard>

      <ChartCard title="Executive Performance" delay={0.16}>
        <div className="overflow-x-auto -mx-1">
          <table className="w-full min-w-[420px] text-left">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-100">
                <th className="pb-3 font-semibold">Executive</th>
                <th className="pb-3 font-semibold text-right">New Leads</th>
                <th className="pb-3 font-semibold text-right">Converted</th>
                <th className="pb-3 font-semibold text-right">Conversion Rate</th>
              </tr>
            </thead>
            <tbody>
              {execRows.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-sm text-slate-400">
                    No executives yet
                  </td>
                </tr>
              )}
              {execRows.map((ex, i) => (
                <tr key={ex.fullName || ex.name} className="border-b border-slate-50 last:border-0">
                  <td className="py-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-8 h-8 rounded-full bg-gradient-to-br ${avatarTone(i)} text-white text-[10px] font-bold flex items-center justify-center shadow-sm`}
                      >
                        {initials(ex.fullName || ex.name)}
                      </div>
                      <span className="text-sm font-semibold text-slate-800">{ex.name}</span>
                    </div>
                  </td>
                  <td className="py-3 text-right text-sm font-semibold tabular-nums text-slate-700">{ex.leads}</td>
                  <td className="py-3 text-right text-sm font-semibold tabular-nums text-slate-700">{ex.conversions}</td>
                  <td className="py-3 text-right">
                    <span className="inline-flex text-xs font-bold tabular-nums px-2 py-1 rounded-lg bg-violet-50 text-violet-700">
                      {ex.conversionRate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>

      <ChartCard title="Monthly Conversion Rate" delay={0.2} action={<PeriodPill label="This Year" />}>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={conversion} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id="smConvFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7C3AED" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#7C3AED" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} unit="%" />
            <Tooltip
              formatter={(v) => [`${v}%`, 'Conversion']}
              contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0' }}
            />
            <Area
              type="monotone"
              dataKey="rate"
              stroke="#7C3AED"
              strokeWidth={2.5}
              fill="url(#smConvFill)"
              dot={{ r: 4, fill: '#7C3AED', strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
