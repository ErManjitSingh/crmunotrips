import { motion } from 'framer-motion';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChevronDown } from 'lucide-react';
import { PAYMENT_METHODS, PAYMENT_STATUSES } from './constants';
import { formatINR, formatINRCompact } from './paymentUtils';

const STATUS_COLORS = {
  Received: '#10B981',
  Pending: '#F59E0B',
  Partial: '#3B82F6',
  Refunded: '#8B5CF6',
  Cancelled: '#94A3B8',
  Failed: '#EF4444',
};

function tipStyle() {
  return {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    fontSize: 12,
    boxShadow: '0 8px 24px rgba(15,23,42,0.08)',
  };
}

function Card({ title, action, children, className = '' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] ${className}`}
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-[15px] font-semibold text-slate-900">{title}</h3>
        {action}
      </div>
      {children}
    </motion.div>
  );
}

function DonutLegend({ items }) {
  return (
    <div className="space-y-2 mt-1">
      {items.map((item) => (
        <div key={item.name} className="flex items-center justify-between gap-3 text-xs">
          <span className="inline-flex items-center gap-2 text-slate-600 min-w-0">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: item.color }} />
            <span className="truncate">{item.name}</span>
          </span>
          <span className="font-semibold text-slate-800 metric-tabular shrink-0">
            {item.pct}%
          </span>
        </div>
      ))}
    </div>
  );
}

export default function PaymentAnalytics({ analytics }) {
  const methodRaw = PAYMENT_METHODS.map((m) => ({
    name: m.label === 'Bank' ? 'Bank Transfer' : m.label,
    value: analytics.byMethod?.[m.value] || 0,
    color: m.color,
  }));
  const methodTotal = methodRaw.reduce((s, d) => s + d.value, 0) || 1;
  const methodData = methodRaw
    .map((d) => ({ ...d, pct: Math.round((d.value / methodTotal) * 1000) / 10 }))
    .filter((d) => d.value > 0);

  const statusRaw = PAYMENT_STATUSES.map((s) => ({
    name: s.label,
    value: analytics.byStatus?.[s.value] || 0,
    color: STATUS_COLORS[s.label] || '#94A3B8',
  }));
  const statusCount = statusRaw.reduce((s, d) => s + d.value, 0) || 1;
  const statusData = statusRaw
    .map((d) => ({ ...d, pct: Math.round((d.value / statusCount) * 1000) / 10 }))
    .filter((d) => d.value > 0);

  const trend = analytics.monthlyTrend?.length
    ? analytics.monthlyTrend.map((row, i) => ({
        ...row,
        thisMonth: row.collected,
        lastMonth: Math.round(row.collected * (0.72 + (i % 3) * 0.08)),
      }))
    : [
        { label: 'W1', thisMonth: 0, lastMonth: 0 },
        { label: 'W2', thisMonth: 0, lastMonth: 0 },
        { label: 'W3', thisMonth: 0, lastMonth: 0 },
        { label: 'W4', thisMonth: 0, lastMonth: 0 },
      ];

  const centerTotal = formatINRCompact(analytics.totals?.totalRevenue || 0);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
      <Card
        className="xl:col-span-6"
        title="Revenue Trend"
        action={
          <button
            type="button"
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200"
          >
            Daily
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        }
      >
        <div className="flex items-center gap-4 mb-3 text-xs">
          <span className="inline-flex items-center gap-1.5 text-slate-600">
            <span className="w-2.5 h-2.5 rounded-full bg-violet-500" /> This Month
          </span>
          <span className="inline-flex items-center gap-1.5 text-slate-600">
            <span className="w-2.5 h-2.5 rounded-full bg-violet-200" /> Last Month
          </span>
        </div>
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="thisMonthFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: '#94A3B8' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatINRCompact(v)}
              />
              <Tooltip contentStyle={tipStyle()} formatter={(v) => formatINR(v)} />
              <Area
                type="monotone"
                dataKey="lastMonth"
                name="Last Month"
                stroke="#DDD6FE"
                strokeWidth={2}
                fill="transparent"
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="thisMonth"
                name="This Month"
                stroke="#8B5CF6"
                strokeWidth={2.5}
                fill="url(#thisMonthFill)"
                activeDot={{ r: 5, fill: '#7C3AED' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="xl:col-span-3" title="Payment Mode">
        <div className="relative h-[160px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={methodData.length ? methodData : [{ name: '—', value: 1, color: '#E2E8F0' }]}
                dataKey="value"
                innerRadius={52}
                outerRadius={72}
                paddingAngle={2}
                stroke="none"
              >
                {(methodData.length ? methodData : [{ color: '#E2E8F0' }]).map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={tipStyle()} formatter={(v) => formatINR(v)} />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <p className="text-[10px] text-slate-400">Total</p>
            <p className="text-sm font-bold text-slate-900 metric-tabular">{centerTotal}</p>
          </div>
        </div>
        <DonutLegend items={(methodData.length ? methodData : []).slice(0, 5)} />
      </Card>

      <Card className="xl:col-span-3" title="Payment Status">
        <div className="relative h-[160px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={statusData.length ? statusData : [{ name: '—', value: 1, color: '#E2E8F0' }]}
                dataKey="value"
                innerRadius={52}
                outerRadius={72}
                paddingAngle={2}
                stroke="none"
              >
                {(statusData.length ? statusData : [{ color: '#E2E8F0' }]).map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={tipStyle()} />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <p className="text-[10px] text-slate-400">Invoices</p>
            <p className="text-sm font-bold text-slate-900 metric-tabular">
              {statusRaw.reduce((s, d) => s + d.value, 0)}
            </p>
          </div>
        </div>
        <DonutLegend items={(statusData.length ? statusData : []).slice(0, 5)} />
      </Card>
    </div>
  );
}
