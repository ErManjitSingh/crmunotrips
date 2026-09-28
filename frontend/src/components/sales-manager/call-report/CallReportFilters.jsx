import { useMemo, useState } from 'react';
import { CalendarDays, Search, X } from 'lucide-react';

function toInputDate(d) {
  const x = new Date(d);
  const yyyy = x.getFullYear();
  const mm = String(x.getMonth() + 1).padStart(2, '0');
  const dd = String(x.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Call Report teams — Sales Executives and Cold Calling agents are reported separately, never mixed. */
export const CALL_REPORT_TEAMS = [
  { key: 'sales', label: 'Sales Executives' },
  { key: 'cold_calling', label: 'Cold Calling' },
];

export const CALL_REPORT_PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
];

export function applyCallReportPreset(key) {
  const now = new Date();
  if (key === 'yesterday') {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    const day = toInputDate(y);
    return { dateFrom: day, dateTo: day };
  }
  const day = toInputDate(now);
  return { dateFrom: day, dateTo: day };
}

export function activeCallReportPreset(filters = {}) {
  for (const preset of CALL_REPORT_PRESETS) {
    const next = applyCallReportPreset(preset.key);
    if (filters.dateFrom === next.dateFrom && filters.dateTo === next.dateTo) return preset.key;
  }
  return 'custom';
}

export default function CallReportFilters({
  filters,
  onChange,
  executives = [],
  executiveId,
  onExecutiveChange,
  search = '',
  onSearchChange,
  team = 'sales',
  onTeamChange,
  selfOnly = false,
}) {
  const [showDates, setShowDates] = useState(false);
  const active = useMemo(() => activeCallReportPreset(filters), [filters]);
  const isCustom = active === 'custom' || showDates;

  const setPreset = (key) => {
    setShowDates(false);
    onChange?.(applyCallReportPreset(key));
  };

  const setDate = (key, value) => {
    onChange?.({ ...filters, [key]: value });
  };

  return (
    <div className="rounded-xl border border-subtle bg-white p-3.5 shadow-sm dark:bg-slate-900/80">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {CALL_REPORT_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => setPreset(preset.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                active === preset.key && !showDates
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'bg-surface-elevated text-content-muted hover:text-content-primary'
              }`}
            >
              {preset.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowDates((v) => !v)}
            className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              isCustom ? 'bg-indigo-600 text-white shadow-sm' : 'bg-surface-elevated text-content-muted hover:text-content-primary'
            }`}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            Custom range
          </button>
        </div>

        {!selfOnly && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl border border-subtle bg-surface-elevated p-1">
              {CALL_REPORT_TEAMS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => onTeamChange?.(t.key)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    team === t.key ? 'bg-violet-600 text-white shadow-sm' : 'text-content-muted hover:text-content-primary'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => onSearchChange?.(e.target.value)}
                placeholder={team === 'cold_calling' ? 'Search cold caller name…' : 'Search executive name…'}
                className="h-10 w-52 rounded-xl border border-subtle bg-white pl-9 pr-3 text-sm font-medium text-content-primary outline-none focus:border-violet-400"
              />
            </div>
            <select
              value={executiveId}
              onChange={(e) => onExecutiveChange?.(e.target.value)}
              className="h-10 min-w-[200px] rounded-xl border border-subtle bg-white px-3 text-sm font-medium text-content-primary"
            >
              <option value="all">{team === 'cold_calling' ? 'All Cold Callers' : 'All Executives'}</option>
              {executives.map((ex) => (
                <option key={ex._id} value={ex._id}>{ex.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {isCustom && (
        <div className="mt-3 flex flex-col gap-2 rounded-lg border border-subtle bg-surface-elevated/60 p-2.5 sm:flex-row sm:items-end">
          <label className="min-w-0 flex-1 text-[10px] font-semibold uppercase tracking-wide text-content-muted">
            From
            <input
              type="date"
              value={filters.dateFrom || ''}
              onChange={(e) => setDate('dateFrom', e.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-subtle bg-white px-2.5 text-xs text-content-primary outline-none focus:border-violet-400"
            />
          </label>
          <label className="min-w-0 flex-1 text-[10px] font-semibold uppercase tracking-wide text-content-muted">
            To
            <input
              type="date"
              value={filters.dateTo || ''}
              onChange={(e) => setDate('dateTo', e.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-subtle bg-white px-2.5 text-xs text-content-primary outline-none focus:border-violet-400"
            />
          </label>
          <button
            type="button"
            onClick={() => { setShowDates(false); onChange?.(applyCallReportPreset('today')); }}
            className="inline-flex h-9 shrink-0 items-center justify-center gap-1 rounded-lg border border-subtle bg-white px-3 text-[11px] font-semibold text-content-muted hover:bg-surface-elevated"
          >
            <X className="h-3 w-3" />
            Reset
          </button>
        </div>
      )}
    </div>
  );
}
