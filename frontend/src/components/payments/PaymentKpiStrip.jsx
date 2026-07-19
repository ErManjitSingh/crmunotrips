import {
  IndianRupee,
  Wallet,
  Clock3,
  BadgePercent,
  AlertCircle,
  CalendarCheck2,
  Gauge,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { cn } from '../../lib/utils';

const ICONS = {
  revenue: IndianRupee,
  received: Wallet,
  pending: Clock3,
  advance: BadgePercent,
  outstanding: AlertCircle,
  today: CalendarCheck2,
  success: Gauge,
};

export default function PaymentKpiStrip({ kpis = [] }) {
  const cards = kpis.filter((k) => k.key !== 'refund').slice(0, 7);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2.5">
      {cards.map((kpi, index) => {
        const Icon = ICONS[kpi.key] || IndianRupee;
        const chartData = (kpi.sparkData || []).map((v, i) => ({ i, v }));
        return (
          <motion.div
            key={kpi.key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: index * 0.04 }}
            className={cn(
              'group relative flex flex-col rounded-xl border border-slate-200/80 bg-white',
              'p-3 min-h-[96px] shadow-[0_1px_3px_rgba(15,23,42,0.04)]',
              'hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)] hover:-translate-y-0.5 transition-all duration-300'
            )}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm',
                  kpi.iconColor
                )}
              >
                <Icon className="w-3.5 h-3.5 text-white" strokeWidth={2.2} />
              </div>
              {kpi.change != null && (
                <span
                  className={cn(
                    'text-[10px] font-semibold',
                    kpi.changeType === 'up' && 'text-emerald-500',
                    kpi.changeType === 'down' && 'text-rose-500',
                    kpi.changeType === 'neutral' && 'text-slate-400'
                  )}
                >
                  {kpi.change}
                </span>
              )}
            </div>

            <p className="text-[10px] font-medium text-slate-500 mb-0.5">{kpi.label}</p>
            <p className="text-lg font-bold text-slate-900 metric-tabular tracking-tight leading-none">
              {kpi.value}
            </p>
            <p className="text-[9px] text-slate-400 mt-1 mb-1">vs last month</p>

            {chartData.length > 0 && (
              <div className="h-7 -mx-1 mt-auto opacity-80 group-hover:opacity-100 transition-opacity">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id={`pay-kpi-${index}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={kpi.sparkColor} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={kpi.sparkColor} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="v"
                      stroke={kpi.sparkColor}
                      strokeWidth={1.75}
                      fill={`url(#pay-kpi-${index})`}
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
