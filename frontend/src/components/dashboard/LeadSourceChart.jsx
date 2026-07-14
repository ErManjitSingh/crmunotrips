import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import DashboardPanel from './DashboardPanel';

const COLORS = ['#3B82F6', '#EC4899', '#64748B', '#22C55E', '#8B5CF6', '#F59E0B', '#06B6D4'];

const SOURCE_LABELS = {
  website: 'Website',
  whatsapp: 'WhatsApp',
  referral: 'Referral',
  walk_in: 'Walk-in',
  walkin: 'Walk-in',
  phone: 'Phone',
  email: 'Email',
  social: 'Social Media',
  google_ads: 'Google Ads',
  facebook_ads: 'Facebook Ads',
  organic: 'Organic',
  other: 'Other',
};

function formatSourceName(name) {
  const key = String(name || 'other').toLowerCase().replace(/\s+/g, '_');
  return SOURCE_LABELS[key] || name || 'Other';
}

function DonutTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-xl border border-subtle bg-surface px-3 py-2 text-sm shadow-lg">
      <p className="font-semibold text-content-primary">{item.name}</p>
      <p className="text-content-muted">
        {item.value} leads ({item.payload.pct}%)
      </p>
    </div>
  );
}

export default function LeadSourceChart({ data = [], total }) {
  const chartData = data.map((item, i) => ({
    name: formatSourceName(item.name),
    value: item.value,
    pct: item.pct,
    color: item.color || COLORS[i % COLORS.length],
  }));

  if (!chartData.length) {
    return (
      <DashboardPanel title="Leads by Source" subtitle="Acquisition channels">
        <p className="py-8 text-center text-sm text-content-muted">No source data yet</p>
      </DashboardPanel>
    );
  }

  const chartTotal = total || chartData.reduce((s, d) => s + d.value, 0);

  return (
    <DashboardPanel title="Leads by Source" subtitle="Where your leads come from" className="h-full">
      <div className="flex flex-col items-center gap-4 sm:flex-row">
        <div className="relative h-[180px] w-full shrink-0 sm:w-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={54}
                outerRadius={78}
                paddingAngle={2.5}
                dataKey="value"
                strokeWidth={0}
              >
                {chartData.map((item, i) => (
                  <Cell key={item.name} fill={item.color || COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<DonutTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-[10px] uppercase tracking-wide text-content-muted">Total</p>
            <p className="text-2xl font-bold text-content-primary metric-tabular">
              {chartTotal.toLocaleString('en-IN')}
            </p>
          </div>
        </div>

        <div className="w-full flex-1 space-y-2.5">
          {chartData.map((item, i) => (
            <motion.div
              key={item.name}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-2.5"
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: item.color || COLORS[i % COLORS.length] }}
              />
              <span className="flex-1 truncate text-sm text-content-secondary">{item.name}</span>
              <span className="text-sm font-bold text-content-primary metric-tabular">{item.pct}%</span>
            </motion.div>
          ))}
        </div>
      </div>
    </DashboardPanel>
  );
}
