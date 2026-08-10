import { useMemo, useState } from 'react';
import { CalendarDays, X } from 'lucide-react';

function toInputDate(d) {
  const x = new Date(d);
  const yyyy = x.getFullYear();
  const mm = String(x.getMonth() + 1).padStart(2, '0');
  const dd = String(x.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export const EXEC_DASHBOARD_PRESETS = [
  { key: 'all', label: 'All Time', destinationPeriod: 'all' },
  { key: 'yesterday', label: 'Yesterday', destinationPeriod: 'yesterday' },
  { key: '7d', label: '7 Days', destinationPeriod: '7d' },
  { key: 'month', label: 'Month', destinationPeriod: 'month' },
];

export function applyExecDashboardPreset(key) {
  const now = new Date();
  if (key === 'all') {
    return { dateFrom: '', dateTo: '', destinationPeriod: 'all' };
  }
  if (key === 'yesterday') {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    const day = toInputDate(y);
    return { dateFrom: day, dateTo: day, destinationPeriod: 'yesterday' };
  }
  if (key === '7d') {
    const from = new Date(now);
    from.setDate(from.getDate() - 6);
    return {
      dateFrom: toInputDate(from),
      dateTo: toInputDate(now),
      destinationPeriod: '7d',
    };
  }
  if (key === 'month') {
    return {
      dateFrom: toInputDate(new Date(now.getFullYear(), now.getMonth(), 1)),
      dateTo: toInputDate(now),
      destinationPeriod: 'month',
    };
  }
  return { dateFrom: '', dateTo: '', destinationPeriod: 'all' };
}

export function getDefaultExecDashboardFilters() {
  return applyExecDashboardPreset('all');
}

export function activeExecDashboardPreset(filters = {}) {
  if (!filters.dateFrom && !filters.dateTo) return 'all';
  for (const preset of EXEC_DASHBOARD_PRESETS) {
    if (preset.key === 'all') continue;
    const next = applyExecDashboardPreset(preset.key);
    if (filters.dateFrom === next.dateFrom && filters.dateTo === next.dateTo) {
      return preset.key;
    }
  }
  return 'custom';
}

/**
 * Compact sales period filter for SE dashboard.
 */
export default function ExecutiveDashboardPeriodFilter({
  filters,
  onChange,
  periodLabel = '',
  compact = false,
}) {
  const [showDates, setShowDates] = useState(false);
  const active = useMemo(() => activeExecDashboardPreset(filters), [filters]);
  const isCustom = active === 'custom' || showDates;

  const setPreset = (key) => {
    setShowDates(false);
    onChange?.(applyExecDashboardPreset(key));
  };

  const setDate = (key, value) => {
    const next = {
      ...filters,
      [key]: value,
      destinationPeriod: 'all',
    };
    onChange?.(next);
  };

  const clearCustom = () => {
    setShowDates(false);
    onChange?.(applyExecDashboardPreset('all'));
  };

  return (
    <div
      className={`rounded-xl border border-sky-100 bg-white shadow-sm ${
        compact ? 'p-2.5' : 'p-3'
      }`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wide text-sky-700">
            Sales period
          </p>
          <p className="truncate text-[11px] text-slate-500">
            {periodLabel || (active === 'all' ? 'All time' : active === 'custom' ? 'Custom range' : EXEC_DASHBOARD_PRESETS.find((p) => p.key === active)?.label)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {EXEC_DASHBOARD_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => setPreset(preset.key)}
              className={`rounded-lg px-2.5 py-1.5 text-[10px] font-semibold transition ${
                active === preset.key && !showDates
                  ? 'bg-sky-600 text-white shadow-sm shadow-sky-500/20'
                  : 'bg-slate-50 text-slate-600 hover:bg-sky-50 hover:text-sky-700'
              }`}
            >
              {preset.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowDates((v) => !v)}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold transition ${
              isCustom
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-50 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700'
            }`}
          >
            <CalendarDays className="h-3 w-3" />
            Date
          </button>
        </div>
      </div>

      {(showDates || active === 'custom') && (
        <div className="mt-2.5 flex flex-col gap-2 rounded-lg border border-slate-100 bg-slate-50/80 p-2.5 sm:flex-row sm:items-end">
          <label className="min-w-0 flex-1 text-[10px] font-semibold text-slate-500">
            From
            <input
              type="date"
              value={filters.dateFrom || ''}
              onChange={(e) => setDate('dateFrom', e.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-800 outline-none focus:border-sky-400"
            />
          </label>
          <label className="min-w-0 flex-1 text-[10px] font-semibold text-slate-500">
            To
            <input
              type="date"
              value={filters.dateTo || ''}
              onChange={(e) => setDate('dateTo', e.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-800 outline-none focus:border-sky-400"
            />
          </label>
          <button
            type="button"
            onClick={clearCustom}
            className="inline-flex h-9 shrink-0 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-[10px] font-semibold text-slate-600 hover:bg-slate-100"
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
