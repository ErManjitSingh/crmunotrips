import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, TrendingUp, PhoneCall, IndianRupee, Medal, Target } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { formatCurrency } from './constants';
import { fetchSalesTargets } from '../../services/salesTargetsApi';
import SetMonthlyTargetModal from '../sales-targets/SetMonthlyTargetModal';

const kpiCards = [
  { key: 'teamRevenue', label: 'Team Revenue', icon: IndianRupee, gradient: 'from-emerald-500 to-teal-600', format: formatCurrency, hint: 'Approved package sales' },
  { key: 'teamConversions', label: 'Team Conversions', icon: TrendingUp, gradient: 'from-violet-500 to-purple-600' },
  { key: 'teamFollowUps', label: 'Team Follow-ups', icon: PhoneCall, gradient: 'from-sky-500 to-blue-600' },
];

const rankColors = ['#f59e0b', '#94a3b8', '#cd7f32', '#6366f1'];

const ROLE_LABELS = {
  sales_executive: 'Sales Executive',
  team_leader: 'Team Leader',
};

function TargetTable({ title, rows, canSetTargets, onSetTarget }) {
  if (!rows.length) return null;

  return (
    <div className="rounded-2xl border border-subtle bg-surface/80 backdrop-blur-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-subtle flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-content-primary flex items-center gap-2">
          <Target className="w-4 h-4 text-sky-600" />
          {title}
        </h3>
        <p className="text-[11px] text-content-muted">Target · Package · Total sales · Profit</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-subtle bg-surface-elevated/50">
              <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-content-muted">Name</th>
              <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-content-muted">Role</th>
              <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-content-muted">Target</th>
              <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-content-muted">Package</th>
              <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-content-muted">Total sales</th>
              <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-content-muted">Profit</th>
              <th className="text-left px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-content-muted">Period</th>
              {canSetTargets && <th className="px-3 py-2.5" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-subtle">
            {rows.map((row) => (
              <tr key={row.userId} className="hover:bg-sky-500/[0.03]">
                <td className="px-3 py-3 font-semibold text-content-primary">{row.name}</td>
                <td className="px-3 py-3 text-xs text-content-muted">{ROLE_LABELS[row.role] || row.role}</td>
                <td className="px-3 py-3 tabular-nums">{formatCurrency(row.revenueTarget || 0)}</td>
                <td className="px-3 py-3 tabular-nums">{formatCurrency(row.packageTarget || 0)}</td>
                <td className="px-3 py-3 tabular-nums">{formatCurrency(row.totalSalesTarget || 0)}</td>
                <td className="px-3 py-3 tabular-nums">{formatCurrency(row.profitTarget || 0)}</td>
                <td className="px-3 py-3 text-xs capitalize text-content-muted">
                  {row.periodType === 'daily' ? `Daily × ${row.workingDays || 26}d` : 'Monthly'}
                </td>
                {canSetTargets && (
                  <td className="px-3 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => onSetTarget(row)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-sky-600 text-white hover:bg-sky-500"
                    >
                      <Target className="w-3 h-3" />
                      Set Target
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function TeamPerformanceDashboard({ data, canSetTargets = false, currentUserRole }) {
  const [targets, setTargets] = useState([]);
  const [loadingTargets, setLoadingTargets] = useState(true);
  const [targetUser, setTargetUser] = useState(null);
  const [pickId, setPickId] = useState('');

  const loadTargets = () => {
    setLoadingTargets(true);
    fetchSalesTargets()
      .then((rows) => setTargets(rows || []))
      .catch(() => setTargets([]))
      .finally(() => setLoadingTargets(false));
  };

  useEffect(() => {
    loadTargets();
  }, []);

  const canSetFor = (role) => {
    if (!canSetTargets) return false;
    if (currentUserRole === 'admin' || currentUserRole === 'sales_manager') {
      return role === 'sales_executive' || role === 'team_leader';
    }
    if (currentUserRole === 'team_leader') return role === 'sales_executive';
    return false;
  };

  const leaders = targets.filter((t) => t.role === 'team_leader' && canSetFor(t.role));
  const executives = targets.filter((t) => t.role === 'sales_executive');
  const showLeaders = leaders.length > 0 && (currentUserRole === 'admin' || currentUserRole === 'sales_manager');
  const showExecutives = executives.length > 0;
  const pickOptions = targets.filter((t) => canSetFor(t.role));

  const openPickedTarget = () => {
    if (!pickId) return;
    const row = pickOptions.find((p) => String(p.userId) === String(pickId));
    if (row) setTargetUser(row);
  };

  const chartData = (data?.members || []).map((m) => ({
    name: m.name.split(' ')[0],
    revenue: m.revenue,
    conversions: m.conversions,
  }));

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-emerald-50 p-4 space-y-3">
        <div>
          <p className="text-sm font-bold text-slate-900">Set target for any executive</p>
          <p className="text-xs text-slate-600 mt-0.5">
            Target, Package, Total sales, and Profit — for Sales Executives and Team Leaders
          </p>
        </div>
        {canSetTargets && (
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={pickId}
              onChange={(e) => setPickId(e.target.value)}
              className="flex-1 h-10 rounded-xl border border-sky-200 bg-white px-3 text-sm"
            >
              <option value="">Select sales executive / team leader…</option>
              {pickOptions.map((p) => (
                <option key={String(p.userId)} value={String(p.userId)}>
                  {p.name} ({ROLE_LABELS[p.role] || p.role})
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!pickId}
              onClick={openPickedTarget}
              className="h-10 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-sm font-semibold inline-flex items-center justify-center gap-1.5"
            >
              <Target className="w-4 h-4" />
              Set Target
            </button>
          </div>
        )}
      </div>

      {loadingTargets ? (
        <div className="rounded-2xl border border-subtle bg-surface/60 p-10 text-center text-content-muted text-sm">
          Loading sales targets…
        </div>
      ) : (
        <div className="space-y-4">
          {showLeaders && (
            <TargetTable
              title="Team Leader targets"
              rows={leaders}
              canSetTargets={canSetTargets}
              onSetTarget={setTargetUser}
            />
          )}
          {showExecutives ? (
            <TargetTable
              title="Sales Executive targets"
              rows={executives}
              canSetTargets={canSetTargets}
              onSetTarget={setTargetUser}
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-subtle bg-surface/60 p-8 text-center text-content-muted text-sm">
              No sales executives found for target setting yet.
            </div>
          )}
        </div>
      )}

      {data?.members?.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {kpiCards.map(({ key, label, icon: Icon, gradient, format, hint }, i) => (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="relative overflow-hidden rounded-2xl border border-subtle bg-surface/80 backdrop-blur-xl p-5"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-[0.07]`} />
                <div className="relative flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-content-muted">{label}</p>
                    <p className="text-2xl font-bold text-content-primary mt-1 tabular-nums">
                      {format ? format(data[key]) : data[key]}
                    </p>
                    {hint && <p className="text-[10px] text-content-muted mt-1">{hint}</p>}
                  </div>
                  <div className={`p-2.5 rounded-xl bg-gradient-to-br ${gradient} text-white shadow-lg`}>
                    <Icon className="w-5 h-5" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-2xl border border-subtle bg-surface/80 backdrop-blur-xl p-5"
            >
              <h3 className="text-sm font-bold text-content-primary mb-4 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" /> Team Ranking
              </h3>
              <div className="space-y-3">
                {data.members.map((member, i) => (
                  <div key={member.name} className="flex items-center gap-4 p-3 rounded-xl bg-surface-elevated/50 border border-subtle">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${i === 0 ? 'bg-amber-500/20 text-amber-600' : 'bg-surface-elevated text-content-muted'}`}>
                      {i === 0 ? <Medal className="w-4 h-4" /> : member.rank}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-content-primary">{member.name}</p>
                      <p className="text-xs text-content-muted">{member.conversions} conversions · {member.followUps} follow-ups</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm text-content-primary tabular-nums">{formatCurrency(member.revenue)}</p>
                      <p className="text-xs text-emerald-600 font-medium">{member.conversionRate}% CR</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28 }}
              className="rounded-2xl border border-subtle bg-surface/80 backdrop-blur-xl p-5"
            >
              <h3 className="text-sm font-bold text-content-primary mb-4">Revenue by Executive</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--color-content-muted)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--color-content-muted)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} />
                    <Tooltip
                      contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 12, fontSize: 12 }}
                      formatter={(v) => [formatCurrency(v), 'Revenue']}
                    />
                    <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                      {chartData.map((_, i) => <Cell key={i} fill={rankColors[i] || '#6366f1'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </div>
        </>
      )}

      <SetMonthlyTargetModal
        open={!!targetUser}
        user={targetUser}
        onClose={() => setTargetUser(null)}
        onSaved={loadTargets}
      />
    </div>
  );
}
