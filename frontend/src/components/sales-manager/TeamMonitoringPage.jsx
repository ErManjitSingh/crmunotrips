import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Medal, TrendingUp, PhoneCall, Trophy, IndianRupee, Target } from 'lucide-react';
import API from '../../api/axios';
import { useDataRefresh } from '../../hooks/useDataRefresh';
import PageHeader from '../ui/PageHeader';
import { formatCurrency } from './managerUtils';

export default function TeamMonitoringPage() {
  const [executives, setExecutives] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchExecutives = useCallback(() => {
    setLoading(true);
    API.get('/sales-manager/executives', { skipSuccessToast: true })
      .then((r) => setExecutives(r.data))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchExecutives();
  }, [fetchExecutives]);

  useDataRefresh(['leads', 'followups', 'quotations'], fetchExecutives);
  const sorted = [...executives].sort((a, b) => b.revenue - a.revenue);

  return (
    <div className="space-y-6">
      <PageHeader title="Team Monitoring" description="Real-time executive performance cards and leaderboard" breadcrumbs={['Sales Manager', 'Team Monitoring']} />

      {loading ? (
        <div className="py-20 text-center text-content-muted">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {executives.map((ex, i) => (
              <motion.div
                key={ex._id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="relative overflow-hidden rounded-2xl border border-subtle bg-surface/80 backdrop-blur-xl p-5"
              >
                <div className="absolute top-0 right-0 w-24 h-24 bg-violet-500/5 rounded-full blur-2xl" />
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-brand-600 flex items-center justify-center text-white font-bold text-sm">
                    {ex.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <p className="font-bold text-content-primary">{ex.name}</p>
                    <p className="text-xs text-content-muted">Rank #{ex.rank}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Assigned', value: ex.assignedLeads, icon: Target },
                    { label: 'Follow-ups', value: ex.followUpsDone, icon: PhoneCall },
                    { label: 'Conversions', value: ex.conversions, icon: Trophy },
                    { label: 'Revenue', value: formatCurrency(ex.revenue), icon: IndianRupee },
                  ].map(({ label, value, icon: Icon }) => (
                    <div key={label} className="p-2.5 rounded-xl bg-surface-elevated/50">
                      <Icon className="w-3.5 h-3.5 text-content-muted mb-1" />
                      <p className="text-[10px] uppercase tracking-wider text-content-muted">{label}</p>
                      <p className="text-sm font-bold text-content-primary tabular-nums">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-subtle flex items-center justify-between">
                  <span className="text-xs text-content-muted">Conversion</span>
                  <span className="text-sm font-bold text-emerald-600 flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> {ex.conversionRate}%</span>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-subtle bg-surface/80 backdrop-blur-xl p-6">
            <h3 className="text-sm font-bold text-content-primary mb-4 flex items-center gap-2"><Medal className="w-4 h-4 text-amber-500" /> Leaderboard</h3>
            <div className="space-y-2">
              {sorted.map((ex, i) => (
                <div key={ex._id} className="flex items-center gap-4 p-4 rounded-xl bg-surface-elevated/40 border border-subtle">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${i === 0 ? 'bg-amber-500/20 text-amber-600' : 'bg-surface-elevated text-content-muted'}`}>
                    {i === 0 ? <Medal className="w-4 h-4" /> : i + 1}
                  </span>
                  <div className="flex-1">
                    <p className="font-semibold text-content-primary">{ex.name}</p>
                    <p className="text-xs text-content-muted">{ex.conversions} conversions · {ex.followUpsDone} follow-ups</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold tabular-nums">{formatCurrency(ex.revenue)}</p>
                    <p className="text-xs text-emerald-600">{ex.conversionRate}% CR</p>
                  </div>
                  <div className="w-24 h-2 rounded-full bg-surface-elevated overflow-hidden hidden sm:block">
                    <div className="h-full bg-gradient-to-r from-violet-500 to-brand-500 rounded-full" style={{ width: `${Math.min(100, ex.conversionRate * 3)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}
