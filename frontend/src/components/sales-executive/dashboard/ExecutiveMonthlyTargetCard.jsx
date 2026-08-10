import { motion } from 'framer-motion';
import {
  CalendarDays,
  IndianRupee,
  Package,
  Target,
  TrendingUp,
  Trophy,
  UserRoundCheck,
} from 'lucide-react';
import { formatCurrency } from '../executiveUtils';

function monthLabel(date = new Date()) {
  return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function monthEndLabel(date = new Date()) {
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return end.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function daysLeftInMonth(date = new Date()) {
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return Math.max(0, end.getDate() - date.getDate());
}

function MetricTile({ icon: Icon, label, value, tone }) {
  const tones = {
    sky: 'border-sky-100 bg-sky-50/80 text-sky-800',
    amber: 'border-amber-100 bg-amber-50/80 text-amber-800',
    emerald: 'border-emerald-100 bg-emerald-50/80 text-emerald-800',
    rose: 'border-rose-100 bg-rose-50/80 text-rose-800',
  };
  return (
    <div className={`min-w-0 rounded-xl border px-3 py-2.5 ${tones[tone] || tones.sky}`}>
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" />
        <span className="truncate text-[9px] font-bold uppercase tracking-wide opacity-75">{label}</span>
      </div>
      <p className="mt-1.5 truncate text-base font-bold tabular-nums tracking-tight sm:text-lg">
        {formatCurrency(value)}
      </p>
    </div>
  );
}

function StatPill({ label, value }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-100 bg-white/80 px-3 py-2 text-center shadow-sm">
      <p className="truncate text-[9px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 truncate text-sm font-bold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}

/**
 * Prominent monthly sales targets for the SE dashboard (desktop + mobile).
 */
export default function ExecutiveMonthlyTargetCard({ target, now = new Date(), compact = false }) {
  if (!target) return null;

  const progress = Math.min(100, Math.max(0, Number(target.progress || 0)));
  const monthlyTarget = Number(
    target.monthlyTarget || target.totalSalesTarget || target.revenueTarget || 0
  );
  const revenueAchieved = Number(target.revenueAchieved || 0);
  const remaining = Math.max(0, monthlyTarget - revenueAchieved);
  const revenueTarget = Number(target.revenueTarget || monthlyTarget || 0);
  const packageTarget = Number(target.packageTarget || 0);
  const totalSalesTarget = Number(target.totalSalesTarget || monthlyTarget || 0);
  const profitTarget = Number(target.profitTarget || 0);
  const left = daysLeftInMonth(now);
  const setBy = target.setByName ? `Set by ${target.setByName}` : 'Assigned by your manager';
  const ringColor = progress >= 100 ? '#10b981' : progress >= 60 ? '#0ea5e9' : '#6366f1';
  const barGradient =
    progress >= 100
      ? 'from-emerald-500 to-teal-500'
      : progress >= 60
        ? 'from-sky-500 to-emerald-500'
        : 'from-indigo-500 to-sky-500';

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`overflow-hidden rounded-2xl border border-sky-200/70 bg-white shadow-md shadow-sky-500/5 ${
        compact ? '' : ''
      }`}
    >
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-indigo-950 to-sky-900 px-4 py-3.5 text-white sm:px-5">
        <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-sky-400/20 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-12 left-1/3 h-28 w-28 rounded-full bg-indigo-400/15 blur-2xl" />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                <Trophy className="h-4 w-4 text-amber-300" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-sky-200/90">
                  Your targets
                </p>
                <h2 className="truncate text-base font-bold tracking-tight sm:text-lg">
                  {monthLabel(now)}
                </h2>
              </div>
            </div>
            <p className="mt-1.5 truncate text-[11px] text-slate-300/90">{setBy}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-2.5 py-1.5 font-medium backdrop-blur-sm">
              <CalendarDays className="h-3.5 w-3.5 text-sky-200" />
              Ends {monthEndLabel(now)}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300/30 bg-amber-400/15 px-2.5 py-1.5 font-semibold text-amber-100">
              {left} day{left === 1 ? '' : 's'} left
            </span>
          </div>
        </div>
      </div>

      <div className={`bg-gradient-to-b from-sky-50/80 to-white ${compact ? 'p-3' : 'p-3.5 sm:p-4'}`}>
        <div className={`flex flex-col gap-4 ${compact ? '' : 'lg:flex-row lg:items-center'}`}>
          <div className="flex min-w-0 flex-1 items-center gap-3.5 sm:gap-4">
            <div
              className={`relative flex shrink-0 items-center justify-center rounded-full ${
                compact ? 'h-[72px] w-[72px]' : 'h-[88px] w-[88px]'
              }`}
              style={{
                background: `conic-gradient(${ringColor} ${progress * 3.6}deg, #e2e8f0 0deg)`,
              }}
            >
              <div className="flex h-[78%] w-[78%] flex-col items-center justify-center rounded-full bg-white shadow-inner">
                <span className={`font-bold leading-none text-slate-900 ${compact ? 'text-lg' : 'text-xl'}`}>
                  {progress}%
                </span>
                <span className="mt-0.5 text-[8px] font-bold uppercase tracking-wide text-slate-400">
                  Done
                </span>
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Revenue progress
              </p>
              <p className={`mt-1 font-bold tabular-nums text-slate-900 ${compact ? 'text-base' : 'text-xl'}`}>
                {formatCurrency(revenueAchieved)}
                <span className="font-medium text-slate-400">
                  {' '}
                  / {formatCurrency(monthlyTarget)}
                </span>
              </p>
              <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-slate-100">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.85, ease: 'easeOut' }}
                  className={`h-full rounded-full bg-gradient-to-r ${barGradient}`}
                />
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                <span className="font-semibold text-slate-700">{formatCurrency(remaining)}</span> remaining
                to hit this month&apos;s goal
              </p>
            </div>
          </div>

          <div className={`grid grid-cols-3 gap-2 ${compact ? '' : 'lg:w-[280px] lg:shrink-0'}`}>
            <StatPill label="Converted" value={target.leadsConverted || 0} />
            <StatPill label="Conv. rate" value={`${Number(target.conversionRate || 0)}%`} />
            <StatPill label="Left" value={formatCurrency(remaining)} />
          </div>
        </div>

        <div className={`mt-3 grid grid-cols-2 gap-2 ${compact ? '' : 'sm:grid-cols-4'}`}>
          <MetricTile icon={IndianRupee} label="Revenue" value={revenueTarget} tone="sky" />
          <MetricTile icon={Package} label="Package" value={packageTarget} tone="amber" />
          <MetricTile icon={TrendingUp} label="Total sales" value={totalSalesTarget} tone="emerald" />
          <MetricTile icon={Target} label="Profit" value={profitTarget} tone="rose" />
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50/70 px-3 py-2 text-[11px] font-medium text-indigo-800">
          <UserRoundCheck className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
          <span className="min-w-0 truncate">
            {target.leadsConverted || 0} leads converted this month
            {target.isDefault ? ' · Default target applied' : ''}
          </span>
        </div>
      </div>
    </motion.section>
  );
}
