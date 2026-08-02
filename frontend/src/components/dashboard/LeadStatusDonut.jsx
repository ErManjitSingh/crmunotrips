import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Flame, Heart, Phone, Users, Trophy } from 'lucide-react';
import DashboardPanel from './DashboardPanel';

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

function SummaryChip({ icon: Icon, label, value, tone }) {
  return (
    <div className={`rounded-xl border px-2.5 py-2 ${tone}`}>
      <div className="flex items-center gap-1.5">
        <Icon className="h-3 w-3 shrink-0 opacity-80" />
        <span className="truncate text-[9px] font-bold uppercase tracking-wide opacity-80">{label}</span>
      </div>
      <p className="mt-1 text-base font-bold tabular-nums leading-none">
        {Number(value || 0).toLocaleString('en-IN')}
      </p>
    </div>
  );
}

/**
 * Same list style as Leads by Source — name, count, % and progress bar under each row.
 * Total in centre matches sum of exclusive status slices.
 */
export default function LeadStatusDonut({ data = [], total = 0, summary = null }) {
  const rows = Array.isArray(data) ? data : [];
  const sumValues = rows.reduce((s, d) => s + (Number(d.value) || 0), 0);
  const displayTotal = Number(summary?.total ?? summary?.arrived ?? total ?? sumValues) || 0;
  const chartData = rows
    .filter((d) => Number(d.value) > 0)
    .map((d) => ({
      name: d.name,
      key: d.key,
      value: Number(d.value) || 0,
      pct: d.pct ?? 0,
      color: d.color,
    }));
  const periodLabel = summary?.periodLabel || 'Selected period';
  const top = chartData[0];

  return (
    <DashboardPanel
      title="Lead Status Distribution"
      subtitle={
        top
          ? `${periodLabel} · Top: ${top.name} (${top.pct}%)`
          : `${periodLabel} · every lead counted once`
      }
      className="h-full"
    >
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
        <SummaryChip
          icon={Users}
          label="Arrived"
          value={displayTotal}
          tone="border-violet-100 bg-violet-50/80 text-violet-800"
        />
        <SummaryChip
          icon={Phone}
          label="Connected"
          value={summary?.connected ?? 0}
          tone="border-emerald-100 bg-emerald-50/80 text-emerald-800"
        />
        <SummaryChip
          icon={Heart}
          label="Interested"
          value={summary?.interested ?? 0}
          tone="border-fuchsia-100 bg-fuchsia-50/80 text-fuchsia-800"
        />
        <SummaryChip
          icon={Flame}
          label="Hot"
          value={summary?.hot ?? 0}
          tone="border-orange-100 bg-orange-50/80 text-orange-800"
        />
        <SummaryChip
          icon={Trophy}
          label="Converted"
          value={summary?.converted ?? 0}
          tone="border-teal-100 bg-teal-50/80 text-teal-800"
        />
      </div>

      {!chartData.length ? (
        <p className="py-8 text-center text-sm text-content-muted">No leads in this period</p>
      ) : (
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
                    <Cell key={item.key || item.name} fill={item.color} />
                  ))}
                </Pie>
                <Tooltip content={<DonutTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Total</p>
              <p className="text-xl font-bold text-slate-900 metric-tabular">
                {Number(displayTotal).toLocaleString('en-IN')}
              </p>
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-2.5 overflow-y-auto pr-0.5 max-h-[200px] scrollbar-thin">
            {chartData.map((item, i) => (
              <motion.div
                key={item.key || item.name}
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
      )}
    </DashboardPanel>
  );
}
