import { useEffect, useState } from 'react';
import { Target } from 'lucide-react';
import AppModal from '../ui/AppModal';
import { Button } from '../ui/button';
import { setSalesTarget } from '../../services/salesTargetsApi';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function toInput(value) {
  if (value === undefined || value === null || value === '') return '';
  return String(value);
}

export default function SetMonthlyTargetModal({ open, onClose, user, onSaved }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [target, setTarget] = useState('');
  const [packageTarget, setPackageTarget] = useState('');
  const [totalSales, setTotalSales] = useState('');
  const [profit, setProfit] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setYear(now.getFullYear());
    setMonth(now.getMonth() + 1);
    const revenue = user.revenueTarget ?? user.monthlyTarget;
    setTarget(toInput(revenue));
    setPackageTarget(toInput(user.packageTarget));
    setTotalSales(toInput(user.totalSalesTarget ?? revenue));
    setProfit(toInput(user.profitTarget));
  }, [open, user]);

  const hasAnyValue = [target, packageTarget, totalSales, profit].some((v) => v !== '');

  const handleSave = async () => {
    if (!user?.userId && !user?._id) return;
    setSaving(true);
    try {
      await setSalesTarget({
        userId: user.userId || user._id,
        revenueTarget: Number(target || 0),
        packageTarget: Number(packageTarget || 0),
        totalSalesTarget: Number(totalSales || 0),
        profitTarget: Number(profit || 0),
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
          <div>
            <h3 className="text-lg font-bold text-content-primary">Set Monthly Target</h3>
            <p className="text-sm text-content-muted">{user?.name}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          <label className="text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-content-muted">Target (₹)</span>
            <input
              type="number"
              min={0}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="e.g. 1500000"
              className="mt-1 w-full rounded-xl border border-subtle bg-surface px-3 py-2.5 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-content-muted">Package total (₹)</span>
            <input
              type="number"
              min={0}
              value={packageTarget}
              onChange={(e) => setPackageTarget(e.target.value)}
              placeholder="e.g. 1200000"
              className="mt-1 w-full rounded-xl border border-subtle bg-surface px-3 py-2.5 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-content-muted">Total sales (₹)</span>
            <input
              type="number"
              min={0}
              value={totalSales}
              onChange={(e) => setTotalSales(e.target.value)}
              placeholder="e.g. 1500000"
              className="mt-1 w-full rounded-xl border border-subtle bg-surface px-3 py-2.5 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-content-muted">Profit (₹)</span>
            <input
              type="number"
              min={0}
              value={profit}
              onChange={(e) => setProfit(e.target.value)}
              placeholder="e.g. 250000"
              className="mt-1 w-full rounded-xl border border-subtle bg-surface px-3 py-2.5 text-sm"
            />
          </label>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="button" onClick={handleSave} disabled={saving || !hasAnyValue} className="bg-sky-600 hover:bg-sky-500 text-white">
            {saving ? 'Saving…' : 'Save Target'}
          </Button>
        </div>
      </div>
    </AppModal>
  );
}
