import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCw,
  Calendar,
  Filter,
  ChevronDown,
  BarChart3,
  X,
} from 'lucide-react';
import { cn } from '../../lib/utils';

const SOURCE_OPTIONS = [
  { value: '', label: 'All Sources' },
  { value: 'dpw', label: 'DPW' },
  { value: 'dpw_wa', label: 'DPW WA' },
  { value: 'dpw_call', label: 'DPW CALL' },
  { value: 'dpw2', label: 'DPW2' },
  { value: 'dpw2_wa', label: 'DPW2 WA' },
  { value: 'dpw2_call', label: 'DPW2 CALL' },
  { value: 'referral', label: 'Referral' },
  { value: 'call_lead', label: 'Call Lead' },
  { value: 'organic', label: 'Organic' },
];

function toInputDate(d) {
  const x = new Date(d);
  const yyyy = x.getFullYear();
  const mm = String(x.getMonth() + 1).padStart(2, '0');
  const dd = String(x.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function getDefaultDashboardFilters() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const today = `${yyyy}-${mm}-${dd}`;
  return {
    dateFrom: today,
    dateTo: today,
    source: '',
  };
}

function applyPreset(key) {
  const now = new Date();
  if (key === 'all') return { dateFrom: '', dateTo: '' };
  if (key === 'today') {
    const day = toInputDate(now);
    return { dateFrom: day, dateTo: day };
  }
  if (key === 'yesterday') {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    const day = toInputDate(y);
    return { dateFrom: day, dateTo: day };
  }
  if (key === 'month') {
    return {
      dateFrom: toInputDate(new Date(now.getFullYear(), now.getMonth(), 1)),
      dateTo: toInputDate(now),
    };
  }
  if (key === '30d') {
    const from = new Date(now);
    from.setDate(from.getDate() - 30);
    return { dateFrom: toInputDate(from), dateTo: toInputDate(now) };
  }
  if (key === '6m') {
    const from = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    return { dateFrom: toInputDate(from), dateTo: toInputDate(now) };
  }
  return { dateFrom: '', dateTo: '' };
}

function activePreset(filters) {
  if (!filters.dateFrom && !filters.dateTo) return 'all';
  for (const key of ['today', 'yesterday', 'month', '30d', '6m']) {
    const preset = applyPreset(key);
    if (filters.dateFrom === preset.dateFrom && filters.dateTo === preset.dateTo) return key;
  }
  return null;
}

const PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'all', label: 'All Time' },
  { key: 'month', label: 'This Month' },
  { key: '30d', label: 'Last 30 Days' },
  { key: '6m', label: 'Last 6 Months' },
];

const VISIBLE_PRESET_COUNT = 5;
const PRIMARY_PRESETS = PRESETS.slice(0, VISIBLE_PRESET_COUNT);
const MORE_PRESETS = PRESETS.slice(VISIBLE_PRESET_COUNT);

export default function DashboardHeader({
  filters,
  onFiltersChange,
  onRefresh,
  isRefreshing = false,
  periodLabel,
}) {
  const currentPreset = activePreset(filters);
  const hasCustomRange = Boolean(filters.dateFrom || filters.dateTo) && !currentPreset;
  const hasSource = Boolean(filters.source);
  const morePresetActive = MORE_PRESETS.some((p) => p.key === currentPreset);
  const [showMore, setShowMore] = useState(hasCustomRange || morePresetActive);
  const morePanelRef = useRef(null);
  const sourceLabel =
    SOURCE_OPTIONS.find((o) => o.value === filters.source)?.label || 'All Sources';
  const activePresetLabel =
    PRESETS.find((p) => p.key === currentPreset)?.label ||
    (hasCustomRange ? 'Custom Range' : 'All Time');

  const clearCustom = () => {
    onFiltersChange({ ...filters, dateFrom: '', dateTo: '', source: '' });
    setShowMore(false);
  };

  const openMoreFilters = () => {
    setShowMore((v) => {
      const next = !v;
      if (next) {
        requestAnimationFrame(() => {
          morePanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
      }
      return next;
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border border-sky-100 bg-white shadow-sm"
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-sky-400 via-blue-500 to-teal-400" />
      <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-sky-100/60 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 left-1/3 h-36 w-36 rounded-full bg-teal-50/80 blur-3xl" />

      <div className="relative space-y-3.5 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex items-start gap-3">
            <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/25">
              <BarChart3 className="h-5 w-5" strokeWidth={2.2} />
            </div>
            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-md bg-sky-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-700 ring-1 ring-inset ring-sky-200">
                  Admin Insights
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
                  <Calendar className="h-3 w-3 text-slate-400" />
                  {activePresetLabel}
                </span>
                {hasSource && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                    <Filter className="h-3 w-3" />
                    {sourceLabel}
                  </span>
                )}
              </div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                Lead Management Report
              </h1>
              <p className="mt-0.5 text-sm text-slate-500">
                Leads &amp; conversions overview
                {periodLabel ? (
                  <span className="text-slate-400"> · {periodLabel}</span>
                ) : null}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {(hasCustomRange || hasSource) && (
              <button
                type="button"
                onClick={clearCustom}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </button>
            )}
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={isRefreshing}
                className={cn(
                  'inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-sky-50 hover:border-sky-200',
                  'disabled:opacity-70'
                )}
              >
                <RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
                Refresh
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
          <div className="inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50/80 p-1 scrollbar-thin">
            {PRIMARY_PRESETS.map((preset) => {
              const active = currentPreset === preset.key && !hasCustomRange;
              return (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => {
                    onFiltersChange({ ...filters, ...applyPreset(preset.key), source: filters.source });
                    setShowMore(false);
                  }}
                  className={cn(
                    'shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-all',
                    active
                      ? 'bg-white text-sky-700 shadow-sm ring-1 ring-sky-200'
                      : 'text-slate-500 hover:bg-white/70 hover:text-slate-700'
                  )}
                >
                  {preset.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={openMoreFilters}
              aria-expanded={showMore}
              aria-label="More filters"
              className={cn(
                'inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-all',
                showMore || hasCustomRange || morePresetActive
                  ? 'bg-white text-sky-700 shadow-sm ring-1 ring-sky-200'
                  : 'text-slate-500 hover:bg-white/70 hover:text-slate-700'
              )}
            >
              <Filter className="h-3.5 w-3.5" />
              <ChevronDown className={cn('h-3 w-3 transition-transform', showMore && 'rotate-180')} />
            </button>
          </div>

          <label className="relative flex w-full items-center gap-2 lg:w-auto lg:min-w-[180px]">
            <Filter className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-slate-400" />
            <select
              value={filters.source}
              onChange={(e) => onFiltersChange({ ...filters, source: e.target.value })}
              className="h-9 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-8 pr-8 text-xs font-semibold text-slate-700 shadow-sm outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
            >
              {SOURCE_OPTIONS.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-slate-400" />
          </label>
        </div>

        <AnimatePresence initial={false}>
          {showMore && (
            <motion.div
              ref={morePanelRef}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="space-y-2.5 rounded-xl border border-sky-100 bg-sky-50/50 p-3">
                {MORE_PRESETS.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {MORE_PRESETS.map((preset) => {
                      const active = currentPreset === preset.key && !hasCustomRange;
                      return (
                        <button
                          key={preset.key}
                          type="button"
                          onClick={() => {
                            onFiltersChange({
                              ...filters,
                              ...applyPreset(preset.key),
                              source: filters.source,
                            });
                          }}
                          className={cn(
                            'rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-all',
                            active
                              ? 'bg-white text-sky-700 shadow-sm ring-1 ring-sky-200'
                              : 'bg-white/70 text-slate-500 ring-1 ring-slate-200 hover:text-slate-700'
                          )}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>
                )}
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <label className="flex min-w-0 flex-col gap-1">
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      <Calendar className="h-3 w-3" /> From
                    </span>
                    <input
                      type="date"
                      value={filters.dateFrom}
                      onChange={(e) => onFiltersChange({ ...filters, dateFrom: e.target.value })}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                    />
                  </label>
                  <label className="flex min-w-0 flex-col gap-1">
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                      <Calendar className="h-3 w-3" /> To
                    </span>
                    <input
                      type="date"
                      value={filters.dateTo}
                      onChange={(e) => onFiltersChange({ ...filters, dateTo: e.target.value })}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-sky-300 focus:ring-2 focus:ring-sky-100"
                    />
                  </label>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
