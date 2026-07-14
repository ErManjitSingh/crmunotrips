import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import Avatar from '../ui/Avatar';
import DashboardPanel from './DashboardPanel';
import { cn } from '../../lib/utils';

const VISIBLE_ROWS = 5;

function rateColor(rate) {
  if (rate >= 20) return 'from-emerald-500 to-emerald-400';
  if (rate >= 12) return 'from-blue-500 to-blue-400';
  if (rate >= 8) return 'from-amber-500 to-amber-400';
  return 'from-orange-500 to-orange-400';
}

export default function ExecutivePerformancePanel({ data, compact = false }) {
  const executives = (data?.executives || []).slice(0, VISIBLE_ROWS);

  return (
    <DashboardPanel
      title="Top Performing Executives"
      subtitle="Lead assignment & conversion"
      action={
        <Link to="/leads/analytics" className="text-xs font-medium text-blue-600 hover:underline">
          View all
        </Link>
      }
      className="h-full"
      noPadding
    >
      {!executives.length ? (
        <p className="px-5 py-8 text-center text-sm text-content-muted">No executive data</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[360px] text-left sm:min-w-[420px]">
            <thead>
              <tr className="border-b border-subtle text-[10px] uppercase tracking-wide text-content-muted sm:text-[11px]">
                <th className="px-3 py-3 font-semibold sm:px-5">Executive</th>
                <th className="px-2 py-3 font-semibold text-right sm:px-3">Leads</th>
                <th className="px-2 py-3 font-semibold text-right sm:px-3">Conv.</th>
                <th className="px-3 py-3 font-semibold sm:px-5">Rate</th>
              </tr>
            </thead>
            <tbody>
              {executives.map((exec, i) => {
                const rate = exec.conversionRate || 0;
                return (
                  <motion.tr
                    key={exec._id || exec.name}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="border-b border-subtle/70 last:border-0"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={exec.name} size="sm" />
                        <span className="text-sm font-semibold text-content-primary">{exec.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3.5 text-right text-sm font-medium text-content-secondary metric-tabular">
                      {exec.assigned ?? 0}
                    </td>
                    <td className="px-3 py-3.5 text-right text-sm font-medium text-content-secondary metric-tabular">
                      {exec.converted ?? 0}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                          <div
                            className={cn('h-full rounded-full bg-gradient-to-r', rateColor(rate))}
                            style={{ width: `${Math.min(rate, 100)}%` }}
                          />
                        </div>
                        <span className="w-12 shrink-0 text-right text-sm font-bold text-content-primary metric-tabular">
                          {rate}%
                        </span>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </DashboardPanel>
  );
}
