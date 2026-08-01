import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import DashboardPanel from './DashboardPanel';

const COLORS = ['#3B82F6', '#EC4899', '#64748B', '#22C55E', '#8B5CF6', '#F59E0B', '#06B6D4', '#F97316'];

const SOURCE_LABELS = {
  dpw: 'DPW',
  dpw_wa: 'DPW WA',
  dpw2: 'DPW2',
  dpw2_wa: 'DPW2 WA',
  referral: 'Referral',
  call_lead: 'Call Lead',
  organic: 'Organic',
  website: 'DPW',
  whatsapp: 'DPW WA',
  walk_in: 'Call Lead',
  walkin: 'Call Lead',
  phone: 'Call Lead',
  email: 'Organic',
  social: 'DPW2',
  google_ads: 'DPW',
  facebook_ads: 'DPW2',
  other: 'Organic',
};

function formatSourceName(name) {
  const key = String(name || 'other').toLowerCase().replace(/\s+/g, '_');
  return SOURCE_LABELS[key] || name || 'Other';
}

function DonutTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-xl border border-subtle bg-white px-3 py-2 text-sm shadow-lg">
      <p className="font-semibold text-slate-900">{item.name}</p>
      <p className="text-slate-500">
        {Number(item.value).toLocaleString('en-IN')} leads · {item.payload.pct}%
      </p>
    </div>
  );
}

export default function LeadSourceChart({ data = [], total }) {
  const chartData = data
    .map((item, i) => ({
      name: formatSourceName(item.name),
      value: Number(item.value) || 0,
      pct: item.pct ?? 0,
      color: item.color || COLORS[i % COLORS.length],
    }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

  if (!chartData.length) {
    return (
      <DashboardPanel title="Leads by Source" subtitle="Acquisition channels">
        <p className="py-8 text-center text-sm text-content-muted">No source data yet</p>
      </DashboardPanel>
    );
  }

  const chartTotal = total || chartData.reduce((s, d) => s + d.value, 0);
  const top = chartData[0];

  return (
    <DashboardPanel
      title="Leads by Source"
      subtitle={top ? `Top: ${top.name} (${top.pct}%)` : 'Where your leads come from'}
      className="h-full"
    >
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-stretch">
        <div className="relative mx-auto h-[140px] w-[140px] shrink-0 sm:mx-0 sm:h-[160px] sm:w-[160px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={44}
                outerRadius={66}
                paddingAngle={3}
                dataKey="value"
                strokeWidth={0}
              >
                {chartData.map((item) => (
                  <Cell key={item.name} fill={item.color} />
                ))}
              </Pie>
              <Tooltip content={<DonutTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Total</p>
            <p className="text-xl font-bold text-slate-900 metric-tabular">
              {Number(chartTotal).toLocaleString('en-IN')}
            </p>
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-2.5 overflow-y-auto pr-0.5 max-h-[200px] scrollbar-thin">
          {chartData.map((item, i) => (
            <motion.div
              key={item.name}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="min-w-0"
            >
              <div className="mb-1 flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white shadow-sm"
                  style={{ background: item.color }}
                />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700" title={item.name}>
                  {item.name}
                </span>
                <span className="shrink-0 text-xs font-semibold text-slate-500 metric-tabular">
                  {Number(item.value).toLocaleString('en-IN')}
                </span>
                <span className="w-11 shrink-0 text-right text-sm font-bold text-slate-900 metric-tabular">
                  {item.pct}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, Math.max(2, item.pct || 0))}%`,
                    background: item.color,
                  }}
                />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </DashboardPanel>
  );
}
