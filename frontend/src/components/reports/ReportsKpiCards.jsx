import { motion } from 'framer-motion';
import { Users, Trophy, TrendingUp, IndianRupee, Wallet, Percent } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { cn } from '../../lib/utils';
import { REPORT_KPI_CONFIG, KPI_THEMES } from './constants';
import { formatINR } from './reportUtils';

const ICONS = { totalLeads: Users, totalConversions: Trophy, conversionRate: TrendingUp, totalRevenue: IndianRupee, avgBookingValue: Wallet, profitMargin: Percent };

export default function ReportsKpiCards({ summary }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5 mb-5">
      {REPORT_KPI_CONFIG.map((cfg, i) => {
        const theme = KPI_THEMES[cfg.color];
        const Icon = ICONS[cfg.key];
        const raw = summary[cfg.key];
        const value = cfg.format === 'currency' ? formatINR(raw) : `${raw}${cfg.suffix || ''}`;
        const spark = summary.sparklines?.[cfg.key === 'totalConversions' ? 'conversions' : cfg.key === 'avgBookingValue' ? 'avgBooking' : cfg.key] || [];

        return (
          <motion.div
            key={cfg.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className={cn('relative overflow-hidden rounded-xl border bg-gradient-to-br backdrop-blur-sm p-3 min-h-[88px] shadow-sm', theme.gradient, theme.border)}
          >
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-2 shadow-md', theme.icon)}>
              <Icon className="w-3.5 h-3.5 text-white" />
            </div>
            <p className={cn('text-xl font-black metric-tabular tracking-tight', theme.text)}>{value}</p>
            <p className="text-[10px] font-medium text-content-muted mt-1">{cfg.label}</p>
            {spark.length > 0 && (
              <div className="h-6 mt-1.5 -mx-1 opacity-60">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={spark.map((v, idx) => ({ idx, v }))}>
                    <Area type="monotone" dataKey="v" stroke="#6366f1" strokeWidth={1.5} fill="#6366f1" fillOpacity={0.1} dot={false} />
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
