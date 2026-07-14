import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
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

export default function LeadStatusDonut({ data = [], total = 0 }) {
  const chartData = (data || []).filter((d) => d.value > 0);
  const displayTotal = total || chartData.reduce((s, d) => s + d.value, 0);

  return (
    <DashboardPanel title="Lead Status Distribution" subtitle="Pipeline breakdown" className="h-full">
      {!chartData.length ? (
        <p className="py-10 text-center text-sm text-content-muted">No status data</p>
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
            </div>
          </div>

          <div className="min-w-0 w-full flex-1 space-y-2 overflow-y-auto pr-1 max-h-[200px] scrollbar-thin">
            {data.map((item, i) => (
              <motion.div
                key={item.key || item.name}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex min-w-0 items-center gap-2"
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
          </div>
        </div>
      )}
    </DashboardPanel>
  );
}
