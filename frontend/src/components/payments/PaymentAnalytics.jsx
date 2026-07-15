import { motion } from 'framer-motion';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PAYMENT_METHODS, PAYMENT_STATUSES, MONTHLY_TARGET } from './constants';
import { formatINR, formatINRCompact } from './paymentUtils';
import { cn } from '../../lib/utils';

function ChartCard({ title, subtitle, children, className }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border border-subtle bg-surface p-5 shadow-sm',
        className
      )}
    >
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-content-primary">{title}</h3>
        {subtitle && <p className="text-xs text-content-muted mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </motion.div>
  );
}

function tipStyle() {
  return {
    background: 'var(--color-surface, #fff)',
    border: '1px solid var(--color-border-subtle, #e2e8f0)',
    borderRadius: 12,
    fontSize: 12,
  };
}

export default function PaymentAnalytics({ analytics }) {
  const methodData = PAYMENT_METHODS.map((m) => ({
    name: m.label,
    value: analytics.byMethod?.[m.value] || 0,
    color: m.color,
  })).filter((d) => d.value > 0);

  const statusData = PAYMENT_STATUSES.map((s) => ({
    name: s.label,
    value: analytics.byStatus?.[s.value] || 0,
    color: s.color.replace('bg-', ''),
  })).filter((d) => d.value > 0);

  const statusColors = {
    Received: '#16C784',
    Pending: '#F59E0B',
    Partial: '#0EA5E9',
    Refunded: '#8B5CF6',
    Cancelled: '#94A3B8',
    Failed: '#EF4444',
  };

  const trend = analytics.monthlyTrend?.length
    ? analytics.monthlyTrend
    : [
        { label: 'Jan', revenue: 0, collected: 0 },
        { label: 'Feb', revenue: 0, collected: 0 },
        { label: 'Mar', revenue: 0, collected: 0 },
      ];

  const target = analytics.target || { collected: 0, remaining: MONTHLY_TARGET, pct: 0 };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <ChartCard
          title="Revenue Trend"
          subtitle="Monthly revenue vs collections"
          className="xl:col-span-2"
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#5B5CEB" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#5B5CEB" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#16C784" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#16C784" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatINRCompact(v)} />
                <Tooltip contentStyle={tipStyle()} formatter={(v) => formatINR(v)} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#5B5CEB" fill="url(#revFill)" strokeWidth={2} />
                <Area type="monotone" dataKey="collected" name="Collected" stroke="#16C784" fill="url(#colFill)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Collection Target" subtitle="Monthly goal tracking">
          <div className="flex flex-col items-center justify-center py-2">
            <div className="relative w-40 h-40">
              <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(148,163,184,0.2)" strokeWidth="10" />
                <motion.circle
                  cx="60"
                  cy="60"
                  r="52"
                  fill="none"
                  stroke="url(#targetGrad)"
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 52}`}
                  initial={{ strokeDashoffset: 2 * Math.PI * 52 }}
                  animate={{ strokeDashoffset: 2 * Math.PI * 52 * (1 - target.pct / 100) }}
                  transition={{ duration: 1.1, ease: 'easeOut' }}
                />
                <defs>
                  <linearGradient id="targetGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#5B5CEB" />
                    <stop offset="100%" stopColor="#16C784" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-3xl font-bold metric-tabular text-content-primary">{target.pct}%</p>
                <p className="text-[11px] text-content-muted">achieved</p>
              </div>
            </div>
            <div className="w-full mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-content-muted">Target</span><span className="font-semibold metric-tabular">{formatINRCompact(MONTHLY_TARGET)}</span></div>
              <div className="flex justify-between"><span className="text-content-muted">Collected</span><span className="font-semibold text-emerald-600 metric-tabular">{formatINRCompact(target.collected)}</span></div>
              <div className="flex justify-between"><span className="text-content-muted">Remaining</span><span className="font-semibold text-amber-600 metric-tabular">{formatINRCompact(target.remaining)}</span></div>
            </div>
          </div>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <ChartCard title="Payment Modes" subtitle="Collection by mode">
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={methodData.length ? methodData : [{ name: 'No data', value: 1, color: '#E2E8F0' }]} dataKey="value" innerRadius={48} outerRadius={72} paddingAngle={3}>
                  {(methodData.length ? methodData : [{ color: '#E2E8F0' }]).map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tipStyle()} formatter={(v) => formatINR(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-2 mt-1">
            {PAYMENT_METHODS.map((m) => (
              <span key={m.value} className="inline-flex items-center gap-1.5 text-[11px] text-content-muted">
                <span className="w-2 h-2 rounded-full" style={{ background: m.color }} />
                {m.label}
              </span>
            ))}
          </div>
        </ChartCard>

        <ChartCard title="Payment Status" subtitle="Invoice lifecycle">
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData.length ? statusData : [{ name: 'No data', value: 1 }]} dataKey="value" innerRadius={48} outerRadius={72} paddingAngle={3}>
                  {(statusData.length ? statusData : [{ name: 'No data' }]).map((entry, i) => (
                    <Cell key={i} fill={statusColors[entry.name] || '#E2E8F0'} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tipStyle()} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-2 mt-1">
            {PAYMENT_STATUSES.slice(0, 5).map((s) => (
              <span key={s.value} className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border', s.soft)}>
                {s.label} · {analytics.byStatus?.[s.value] || 0}
              </span>
            ))}
          </div>
        </ChartCard>

        <ChartCard title="Destination Revenue" subtitle="Top travel destinations" className="md:col-span-1 xl:col-span-1">
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.destinationRevenue?.length ? analytics.destinationRevenue : [{ name: '—', value: 0 }]} layout="vertical" margin={{ left: 8, right: 8 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tipStyle()} formatter={(v) => formatINR(v)} />
                <Bar dataKey="value" radius={[0, 8, 8, 0]} fill="#5B5CEB" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Executive Collection" subtitle="Top collectors">
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.executiveRevenue?.length ? analytics.executiveRevenue : [{ name: '—', value: 0 }]}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={48} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatINRCompact(v)} />
                <Tooltip contentStyle={tipStyle()} formatter={(v) => formatINR(v)} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="#16C784" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
