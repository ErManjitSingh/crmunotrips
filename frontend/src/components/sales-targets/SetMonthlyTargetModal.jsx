import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Target } from 'lucide-react';
import AppModal from '../ui/AppModal';
import { Button } from '../ui/button';
import { fetchSalesTargets, setSalesTarget } from '../../services/salesTargetsApi';
import { cn } from '../../lib/utils';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const ROLE_LABELS = {
  sales_executive: 'Sales Executive',
  team_leader: 'Team Leader',
};

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function defaultWorkingDays(year, month) {
  return Math.min(daysInMonth(year, month), 26);
}

function roundMoney(n) {
  return Math.round(Number(n || 0));
}

function monthlyFromDisplay(value, periodType, workingDays) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n < 0) return 0;
  if (periodType === 'daily') return roundMoney(n * workingDays);
  return roundMoney(n);
}

function displayFromMonthly(monthly, periodType, workingDays) {
  const n = Number(monthly || 0);
  if (!n) return '';
  if (periodType === 'daily' && workingDays > 0) {
    return String(roundMoney(n / workingDays));
  }
  return String(roundMoney(n));
}

export default function SetMonthlyTargetModal({ open, onClose, user, onSaved }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [periodType, setPeriodType] = useState('monthly');
  const [workingDays, setWorkingDays] = useState(26);
  const [target, setTarget] = useState('');
  const [packageTarget, setPackageTarget] = useState('');
  const [totalSales, setTotalSales] = useState('');
  const [profit, setProfit] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingPeriod, setLoadingPeriod] = useState(false);
  const [periodReady, setPeriodReady] = useState(false);

  const userId = user?.userId || user?._id;
  const roleLabel = ROLE_LABELS[user?.role] || user?.role || 'Team member';
  const maxDays = daysInMonth(year, month);

  const applyTargetRow = (row) => {
    const type = row?.periodType === 'daily' ? 'daily' : 'monthly';
    const days = Math.min(
      maxDays,
      Math.max(1, Number(row?.workingDays) || defaultWorkingDays(year, month))
    );
    const revenue = row?.revenueTarget ?? row?.monthlyTarget ?? 0;
    setPeriodType(type);
    setWorkingDays(days);
    setTarget(displayFromMonthly(revenue, type, days));
    setPackageTarget(displayFromMonthly(row?.packageTarget, type, days));
    setTotalSales(displayFromMonthly(row?.totalSalesTarget ?? revenue, type, days));
    setProfit(displayFromMonthly(row?.profitTarget, type, days));
  };

  useEffect(() => {
    if (!open || !userId) {
      setPeriodReady(false);
      return;
    }
    setYear(now.getFullYear());
    setMonth(now.getMonth() + 1);
    setPeriodReady(true);
  }, [open, userId]);

  useEffect(() => {
    if (!open || !userId || !periodReady) return;
    let cancelled = false;
    setLoadingPeriod(true);

    fetchSalesTargets({ year, month })
      .then((rows) => {
        if (cancelled) return;
        const row = (rows || []).find((r) => String(r.userId) === String(userId));
        if (row) {
          applyTargetRow(row);
          return;
        }
        applyTargetRow({
          revenueTarget: 0,
          packageTarget: 0,
          totalSalesTarget: 0,
          profitTarget: 0,
          periodType: 'monthly',
          workingDays: defaultWorkingDays(year, month),
        });
        setTarget('');
        setPackageTarget('');
        setTotalSales('');
        setProfit('');
      })
      .catch(() => {
        if (cancelled) return;
        applyTargetRow({
          revenueTarget: user?.revenueTarget ?? user?.monthlyTarget,
          packageTarget: user?.packageTarget,
          totalSalesTarget: user?.totalSalesTarget ?? user?.revenueTarget ?? user?.monthlyTarget,
          profitTarget: user?.profitTarget,
          periodType: user?.periodType || 'monthly',
          workingDays: user?.workingDays || defaultWorkingDays(year, month),
        });
      })
      .finally(() => {
        if (!cancelled) setLoadingPeriod(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, userId, year, month, periodReady]);

  const switchPeriodType = (nextType) => {
    if (nextType === periodType) return;
    const days = Math.min(maxDays, Math.max(1, Number(workingDays) || defaultWorkingDays(year, month)));
    const monthlyTarget = monthlyFromDisplay(target, periodType, days);
    const monthlyPackage = monthlyFromDisplay(packageTarget, periodType, days);
    const monthlySales = monthlyFromDisplay(totalSales, periodType, days);
    const monthlyProfit = monthlyFromDisplay(profit, periodType, days);
    setPeriodType(nextType);
    setTarget(displayFromMonthly(monthlyTarget, nextType, days));
    setPackageTarget(displayFromMonthly(monthlyPackage, nextType, days));
    setTotalSales(displayFromMonthly(monthlySales, nextType, days));
    setProfit(displayFromMonthly(monthlyProfit, nextType, days));
  };

  const onWorkingDaysChange = (raw) => {
    const nextDays = Math.min(maxDays, Math.max(1, Number(raw) || 1));
    if (periodType === 'daily') {
      const monthlyTarget = monthlyFromDisplay(target, 'daily', workingDays);
      const monthlyPackage = monthlyFromDisplay(packageTarget, 'daily', workingDays);
      const monthlySales = monthlyFromDisplay(totalSales, 'daily', workingDays);
      const monthlyProfit = monthlyFromDisplay(profit, 'daily', workingDays);
      setWorkingDays(nextDays);
      setTarget(displayFromMonthly(monthlyTarget, 'daily', nextDays));
      setPackageTarget(displayFromMonthly(monthlyPackage, 'daily', nextDays));
      setTotalSales(displayFromMonthly(monthlySales, 'daily', nextDays));
      setProfit(displayFromMonthly(monthlyProfit, 'daily', nextDays));
      return;
    }
    setWorkingDays(nextDays);
  };

  const monthlyPreview = useMemo(() => {
    const days = Math.min(maxDays, Math.max(1, Number(workingDays) || 1));
    return {
      target: monthlyFromDisplay(target, periodType, days),
      packageTarget: monthlyFromDisplay(packageTarget, periodType, days),
      totalSales: monthlyFromDisplay(totalSales, periodType, days),
      profit: monthlyFromDisplay(profit, periodType, days),
      days,
    };
  }, [target, packageTarget, totalSales, profit, periodType, workingDays, maxDays]);

  const hasAnyValue = [target, packageTarget, totalSales, profit].some((v) => v !== '');
  const unitLabel = periodType === 'daily' ? 'per day (₹)' : '(₹)';

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      await setSalesTarget({
        userId,
        revenueTarget: monthlyPreview.target,
        packageTarget: monthlyPreview.packageTarget,
        totalSalesTarget: monthlyPreview.totalSales,
        profitTarget: monthlyPreview.profit,
        periodType,
        workingDays: monthlyPreview.days,
        year,
        month,
      });
      onSaved?.();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppModal open={open} onClose={() => !saving && onClose()} size="md">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-emerald-600 text-white flex items-center justify-center">
            <Target className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-content-primary">Set Target</h3>
            <p className="text-sm text-content-muted truncate">
              {user?.name}
              <span className="mx-1.5 text-content-muted/50">·</span>
              <span className="font-medium text-sky-700">{roleLabel}</span>
            </p>
          </div>
        </div>

        <div className="mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-content-muted mb-2">
            Target period (Monthly / Daily)
          </p>
          <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 border border-slate-200">
            {[
              { id: 'monthly', label: 'Monthly' },
              { id: 'daily', label: 'Daily' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => switchPeriodType(opt.id)}
                className={cn(
                  'h-9 rounded-lg text-sm font-semibold transition-colors',
                  periodType === opt.id
                    ? 'bg-white text-sky-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <label className="text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-content-muted">Month</span>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-subtle bg-surface px-3 py-2.5 text-sm"
            >
              {MONTHS.map((label, i) => (
                <option key={label} value={i + 1}>{label}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-content-muted">Year</span>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-subtle bg-surface px-3 py-2.5 text-sm"
            />
          </label>
        </div>

        <label className="text-sm block mb-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-content-muted inline-flex items-center gap-1">
            <CalendarDays className="w-3.5 h-3.5" /> Working days
          </span>
          <input
            type="number"
            min={1}
            max={maxDays}
            value={workingDays}
            onChange={(e) => onWorkingDaysChange(e.target.value)}
            className="mt-1 w-full rounded-xl border border-subtle bg-surface px-3 py-2.5 text-sm"
          />
          <span className="text-[11px] text-content-muted mt-1 block">
            Daily target × working days = monthly total · max {maxDays} in {MONTHS[month - 1]}
          </span>
        </label>

        {loadingPeriod ? (
          <p className="text-sm text-content-muted mb-4">Loading targets…</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <label className="text-sm">
              <span className="text-xs font-semibold uppercase tracking-wide text-content-muted">Target {unitLabel}</span>
              <input
                type="number"
                min={0}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder={periodType === 'daily' ? 'e.g. 50000' : 'e.g. 1500000'}
                className="mt-1 w-full rounded-xl border border-subtle bg-surface px-3 py-2.5 text-sm"
              />
            </label>
            <label className="text-sm">
              <span className="text-xs font-semibold uppercase tracking-wide text-content-muted">Package {unitLabel}</span>
              <input
                type="number"
                min={0}
                value={packageTarget}
                onChange={(e) => setPackageTarget(e.target.value)}
                placeholder={periodType === 'daily' ? 'e.g. 40000' : 'e.g. 1200000'}
                className="mt-1 w-full rounded-xl border border-subtle bg-surface px-3 py-2.5 text-sm"
              />
            </label>
            <label className="text-sm">
              <span className="text-xs font-semibold uppercase tracking-wide text-content-muted">Total sales {unitLabel}</span>
              <input
                type="number"
                min={0}
                value={totalSales}
                onChange={(e) => setTotalSales(e.target.value)}
                placeholder={periodType === 'daily' ? 'e.g. 50000' : 'e.g. 1500000'}
                className="mt-1 w-full rounded-xl border border-subtle bg-surface px-3 py-2.5 text-sm"
              />
            </label>
            <label className="text-sm">
              <span className="text-xs font-semibold uppercase tracking-wide text-content-muted">Profit {unitLabel}</span>
              <input
                type="number"
                min={0}
                value={profit}
                onChange={(e) => setProfit(e.target.value)}
                placeholder={periodType === 'daily' ? 'e.g. 8000' : 'e.g. 250000'}
                className="mt-1 w-full rounded-xl border border-subtle bg-surface px-3 py-2.5 text-sm"
              />
            </label>
          </div>
        )}

        {periodType === 'daily' && hasAnyValue && (
          <div className="mb-5 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2.5 text-xs text-sky-800">
            Monthly total → Target ₹{monthlyPreview.target.toLocaleString('en-IN')}
            {monthlyPreview.packageTarget
              ? ` · Package ₹${monthlyPreview.packageTarget.toLocaleString('en-IN')}`
              : ''}
            {monthlyPreview.totalSales
              ? ` · Sales ₹${monthlyPreview.totalSales.toLocaleString('en-IN')}`
              : ''}
            {monthlyPreview.profit
              ? ` · Profit ₹${monthlyPreview.profit.toLocaleString('en-IN')}`
              : ''}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || !hasAnyValue || loadingPeriod}
            className="bg-sky-600 hover:bg-sky-500 text-white"
          >
            {saving ? 'Saving…' : 'Save Target'}
          </Button>
        </div>
      </div>
    </AppModal>
  );
}
