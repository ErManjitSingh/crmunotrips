import { motion } from 'framer-motion';
import DashboardPanel from './DashboardPanel';

const FILLS = ['#7C3AED', '#6366F1', '#3B82F6', '#0EA5E9', '#10B981'];

function pct(n, d) {
  if (!d) return 0;
  return Math.round((n / d) * 10000) / 100;
}

export default function AdminSalesFunnel({ data = [] }) {
  const stages = data.length
    ? data
    : [
        { stage: 'Leads', count: 0 },
        { stage: 'Connected', count: 0 },
        { stage: 'Qualified', count: 0 },
        { stage: 'Quotations', count: 0 },
        { stage: 'Bookings', count: 0 },
      ];

  const leads = Number(stages[0]?.count || 0) || 1;
  const connected = Number(stages[1]?.count || 0);
  const qualified = Number(stages[2]?.count || 0);
  const quotations = Number(stages[3]?.count || 0);
  const bookings = Number(stages[4]?.count || 0);

  const conversions = [
    { label: 'Overall Conversion', value: pct(bookings, leads) },
    { label: 'Lead → Connected', value: pct(connected, leads) },
    { label: 'Connected → Qualified', value: pct(qualified, connected) },
    { label: 'Qualified → Booking', value: pct(bookings, qualified) },
  ];

  const max = Math.max(...stages.map((s) => Number(s.count || 0)), 1);

  return (
    <DashboardPanel title="Sales Funnel" subtitle="This Month" className="h-full">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
        <div className="flex-1 space-y-2">
          {stages.map((stage, i) => {
            const width = Math.max(28, Math.round((Number(stage.count || 0) / max) * 100));
            return (
              <motion.div
                key={stage.stage}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="relative"
              >
                <div
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-white shadow-sm"
                  style={{
                    width: `${width}%`,
                    minWidth: '140px',
                    background: FILLS[i % FILLS.length],
                  }}
                >
                  <span className="text-xs font-medium">{stage.stage}</span>
                  <span className="text-sm font-bold tabular-nums">
                    {Number(stage.count || 0).toLocaleString('en-IN')}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
        <div className="w-full shrink-0 space-y-2 lg:w-44">
          {conversions.map((c) => (
            <div
              key={c.label}
              className="rounded-xl border border-subtle bg-surface-elevated/40 px-3 py-2"
            >
              <p className="text-[10px] font-medium text-content-muted">{c.label}</p>
              <p className="mt-0.5 text-sm font-bold text-content-primary tabular-nums">
                {c.value.toFixed(2)}%
              </p>
            </div>
          ))}
        </div>
      </div>
    </DashboardPanel>
  );
}
