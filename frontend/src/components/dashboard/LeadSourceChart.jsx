import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Phone, Users } from 'lucide-react';
import DashboardPanel from './DashboardPanel';

const FALLBACK_COLORS = ['#3B82F6', '#0EA5E9', '#F59E0B', '#10B981', '#6366F1', '#F97316', '#64748B', '#EC4899'];

const SOURCE_LABELS = {
  dpw: 'DPW',
  dpw_wa: 'DPW WA',
  dpw_call: 'DPW CALL',
  dpw2: 'DPW2',
  dpw2_wa: 'DPW2 WA',
  dpw2_call: 'DPW2 CALL',
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

const SOURCE_COLORS = {
  DPW: '#7C3AED',
  'DPW WA': '#14B8A6',
  'DPW CALL': '#F59E0B',
  DPW2: '#3B82F6',
  'DPW2 WA': '#0EA5E9',
  'DPW2 CALL': '#F97316',
  Referral: '#8B5CF6',
  'Call Lead': '#10B981',
  Organic: '#64748B',
};

function formatSourceName(name) {
  const key = String(name || 'other').toLowerCase().replace(/\s+/g, '_');
  return SOURCE_LABELS[key] || name || 'Other';
}

function sourceColor(name, index) {
  return SOURCE_COLORS[name] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

function DonutTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const connected = Number(item.payload?.connected || 0);
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm shadow-xl">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.payload?.color }} />
        <p className="font-semibold text-slate-900">{item.name}</p>
      </div>
      <div className="space-y-0.5 text-[13px]">
        <p className="flex justify-between gap-6 text-slate-600">
          <span>Total leads</span>
          <span className="font-bold text-slate-900 metric-tabular">
            {Number(item.value).toLocaleString('en-IN')}
          </span>
        </p>
        <p className="flex justify-between gap-6 text-emerald-700">
          <span>Connected</span>
          <span className="font-bold metric-tabular">{connected.toLocaleString('en-IN')}</span>
        </p>
      </div>
    </div>
  );
}

function StatChip({ icon: Icon, label, value, tone }) {
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${tone}`}>
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" />
        <span className="text-[10px] font-bold uppercase tracking-wide opacity-80">{label}</span>
      </div>
      <p className="mt-1.5 text-xl font-bold tabular-nums leading-none metric-tabular">
        {Number(value || 0).toLocaleString('en-IN')}
      </p>
    </div>
  );
}

export default function LeadSourceChart({ data = [], total }) {
  const chartData = data
    .map((item, i) => {
      const name = formatSourceName(item.name);
      return {
        name,
        value: Number(item.value) || 0,
        connected: Number(item.connected || 0),
        color: item.color && !SOURCE_COLORS[name] ? item.color : sourceColor(name, i),
      };
    })
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

  if (!chartData.length) {
    return (
      <DashboardPanel title="Leads by Source" subtitle="Total leads and connected by channel">
        <p className="py-8 text-center text-sm text-content-muted">No source data yet</p>
      </DashboardPanel>
    );
  }

  const chartTotal = total || chartData.reduce((s, d) => s + d.value, 0);
  const connectedTotal = chartData.reduce((s, d) => s + d.connected, 0);
  const top = chartData[0];
  const maxLeads = Math.max(...chartData.map((d) => d.value), 1);

  return (
    <DashboardPanel
      title="Leads by Source"
      subtitle={
        top
          ? `Top channel: ${top.name} · ${Number(top.value).toLocaleString('en-IN')} leads`
          : 'Total leads and connected by channel'
      }
      className="h-full"
    >
      <div className="mb-4 grid grid-cols-2 gap-2">
        <StatChip
          icon={Users}
          label="Total Leads"
          value={chartTotal}
          tone="border-sky-100 bg-sky-50/90 text-sky-900"
        />
        <StatChip
          icon={Phone}
          label="Connected"
          value={connectedTotal}
          tone="border-emerald-100 bg-emerald-50/90 text-emerald-900"
        />
      </div>

      <div className="flex min-w-0 flex-col gap-5 lg:flex-row lg:items-start">
        <div className="relative mx-auto h-[150px] w-[150px] shrink-0 sm:h-[168px] sm:w-[168px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={48}
                outerRadius={70}
                paddingAngle={2.5}
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
            <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Leads</p>
            <p className="text-2xl font-bold text-slate-900 metric-tabular">
              {Number(chartTotal).toLocaleString('en-IN')}
            </p>
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-2.5 overflow-y-auto pr-0.5 max-h-[260px] scrollbar-thin">
          <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_5rem] gap-2 border-b border-slate-100 pb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
            <span>Source</span>
            <span className="text-right">Leads</span>
            <span className="text-right text-emerald-600/80">Connected</span>
          </div>

          {chartData.map((item, i) => {
            const leadShare = (item.value / maxLeads) * 100;
            const connectedShare = item.value > 0 ? (item.connected / item.value) * 100 : 0;
            return (
              <motion.div
                key={item.name}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="rounded-xl border border-slate-100 bg-slate-50/60 px-2.5 py-2 hover:bg-white hover:border-slate-200 transition-colors"
              >
                <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_5rem] items-center gap-2">
                  <div className="min-w-0 flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white shadow-sm"
                      style={{ background: item.color }}
                    />
                    <span className="truncate text-sm font-semibold text-slate-800" title={item.name}>
                      {item.name}
                    </span>
                  </div>
                  <span className="text-right text-sm font-bold text-slate-900 metric-tabular">
                    {Number(item.value).toLocaleString('en-IN')}
                  </span>
                  <span className="text-right text-sm font-bold text-emerald-600 metric-tabular">
                    {Number(item.connected).toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="mt-2 space-y-1">
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-200/80">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, Math.max(4, leadShare))}%`,
                        background: item.color,
                      }}
                    />
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-emerald-100">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{
                        width: `${Math.min(100, Math.max(item.connected > 0 ? 4 : 0, connectedShare))}%`,
                      }}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </DashboardPanel>
  );
}
