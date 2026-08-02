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
        <div className="relative mx-auto h-[160px] w-[160px] sm:h-[180px] sm:w-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={48}
                outerRadius={72}
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
            <p className="text-xl font-bold text-slate-900 metric-tabular sm:text-2xl">
              {Number(displayTotal).toLocaleString('en-IN')}
            </p>
          </div>
        </div>
      )}
    </DashboardPanel>
  );
}
