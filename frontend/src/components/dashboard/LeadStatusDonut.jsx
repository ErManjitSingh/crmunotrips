import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Flame, Heart, Phone, Users, Trophy } from 'lucide-react';
import DashboardPanel from './DashboardPanel';

function DonutTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-xl border border-subtle bg-surface px-3 py-2 text-sm shadow-lg">
      <p className="font-semibold text-content-primary">{item.name}</p>
      <p className="text-content-muted">
        {Number(item.value).toLocaleString('en-IN')} ({item.payload.pct}%)
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
      <p className="mt-1 text-base font-bold tabular-nums leading-none">{Number(value || 0).toLocaleString('en-IN')}</p>
    </div>
  );
}

/**
 * Exclusive status breakdown — total in centre must equal sum of slices
 * (same count as leads arrived in the selected period).
 */
export default function LeadStatusDonut({ data = [], total = 0, summary = null }) {
  const rows = Array.isArray(data) ? data : [];
  const sumValues = rows.reduce((s, d) => s + (Number(d.value) || 0), 0);
  const displayTotal = Number(summary?.total ?? summary?.arrived ?? total ?? sumValues) || 0;
  const chartData = rows.filter((d) => Number(d.value) > 0);
  const legendRows = rows; // show zeros so the full story is clear
  const periodLabel = summary?.periodLabel || 'Selected period';

  return (
    <DashboardPanel
      title="Lead Status Distribution"
      subtitle={`${periodLabel} · every lead counted once`}
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
        <div className="flex min-w-0 flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div className="relative h-[150px] w-[150px] shrink-0 sm:h-[170px] sm:w-[170px]">
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
                  {chartData.map((item, i) => (
                    <Cell key={item.key || i} fill={item.color} />
                  ))}
                </Pie>
                <Tooltip content={<DonutTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-[10px] uppercase tracking-wide text-content-muted">Total</p>
              <p className="text-xl font-bold text-content-primary metric-tabular sm:text-2xl">
                {Number(displayTotal).toLocaleString('en-IN')}
              </p>
              {sumValues !== displayTotal ? (
                <p className="mt-0.5 text-[9px] font-semibold text-amber-600">check {sumValues}</p>
              ) : (
                <p className="mt-0.5 text-[9px] text-emerald-600">matches list</p>
              )}
            </div>
          </div>

          <div className="min-w-0 w-full flex-1 space-y-1.5 overflow-y-auto pr-1 max-h-[220px] scrollbar-thin">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-content-muted">
              What happened to these leads
            </p>
            {legendRows.map((item, i) => (
              <motion.div
                key={item.key || item.name}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className={`flex min-w-0 items-center gap-2 rounded-lg px-1.5 py-1 ${
                  Number(item.value) > 0 ? 'bg-transparent' : 'opacity-45'
                }`}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.color }} />
                <span className="min-w-0 flex-1 truncate text-sm text-content-secondary" title={item.name}>
                  {item.name}
                </span>
                <span className="w-10 shrink-0 text-right text-xs font-semibold text-content-muted metric-tabular">
                  {Number(item.value).toLocaleString('en-IN')}
                </span>
                <span className="w-12 shrink-0 text-right text-sm font-bold text-content-primary metric-tabular">
                  {item.pct}%
                </span>
              </motion.div>
            ))}
            <p className="pt-1 text-[10px] text-content-muted">
              Hot is a priority flag (can overlap statuses). Interested = connected + working + follow-up + quotation + negotiation.
            </p>
          </div>
        </div>
      )}
    </DashboardPanel>
  );
}
