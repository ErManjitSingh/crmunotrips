import { motion } from 'framer-motion';
import { RefreshCw, Calendar, Filter, Megaphone } from 'lucide-react';
import { cn } from '../../lib/utils';

const SOURCE_OPTIONS = [
  { value: '', label: 'All Sources' },
  { value: 'google_ads', label: 'Google Ads' },
  { value: 'facebook_ads', label: 'Facebook Ads' },
  { value: 'website', label: 'Website' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'referral', label: 'Referral' },
  { value: 'phone', label: 'Phone' },
  { value: 'walk-in', label: 'Walk-in' },
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
  return {
    dateFrom: '',
    dateTo: '',
    source: '',
  };
}

function applyPreset(key) {
  const now = new Date();
  if (key === 'all') return { dateFrom: '', dateTo: '' };
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
  const month = applyPreset('month');
  if (filters.dateFrom === month.dateFrom && filters.dateTo === month.dateTo) return 'month';
  const d30 = applyPreset('30d');
  if (filters.dateFrom === d30.dateFrom && filters.dateTo === d30.dateTo) return '30d';
  const m6 = applyPreset('6m');
  if (filters.dateFrom === m6.dateFrom && filters.dateTo === m6.dateTo) return '6m';
  return null;
}

const PRESETS = [
  { key: 'all', label: 'All Time' },
  { key: 'month', label: 'This Month' },
  { key: '30d', label: 'Last 30 Days' },
  { key: '6m', label: 'Last 6 Months' },
];

export default function DashboardHeader({
  filters,
  onFiltersChange,
  onRefresh,
  isRefreshing = false,
  periodLabel,
}) {
  const currentPreset = activePreset(filters);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border border-subtle bg-surface shadow-sm"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(59,130,246,0.08),_transparent_55%),radial-gradient(ellipse_at_bottom_left,_rgba(16,185,129,0.06),_transparent_50%)]" />
      <div className="relative space-y-4 p-4 sm:p-5 lg:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
              <Megaphone className="h-3.5 w-3.5" />
              Admin Insights
            </div>
            <h1 className="text-xl font-bold tracking-tight text-content-primary sm:text-2xl lg:text-[30px] lg:leading-tight">
              Lead Management Report
            </h1>
            <p className="mt-1 text-sm text-content-secondary">
              Overview of leads &amp; conversions performance
              {periodLabel ? (
                <span className="text-content-muted"> · {periodLabel}</span>
              ) : null}
            </p>
          </div>

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className={cn(
                'inline-flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-subtle bg-surface px-4 text-sm font-semibold text-content-primary transition-colors hover:bg-surface-elevated sm:w-auto',
                'disabled:opacity-70'
              )}
            >
              <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
              Refresh
            </button>
          )}
        </div>

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-thin">
          {PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => onFiltersChange({ ...filters, ...applyPreset(preset.key) })}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                currentPreset === preset.key
                  ? 'border-blue-500 bg-blue-500 text-white shadow-sm'
                  : 'border-subtle bg-surface text-content-secondary hover:bg-surface-elevated'
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex min-w-0 flex-col gap-1">
            <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-content-muted">
              <Calendar className="h-3 w-3" /> From
            </span>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => onFiltersChange({ ...filters, dateFrom: e.target.value })}
              className="input-premium h-10 w-full rounded-xl text-sm"
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1">
            <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-content-muted">
              <Calendar className="h-3 w-3" /> To
            </span>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => onFiltersChange({ ...filters, dateTo: e.target.value })}
              className="input-premium h-10 w-full rounded-xl text-sm"
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1 sm:col-span-2 lg:col-span-1">
            <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-content-muted">
              <Filter className="h-3 w-3" /> Source
            </span>
            <select
              value={filters.source}
              onChange={(e) => onFiltersChange({ ...filters, source: e.target.value })}
              className="input-premium h-10 w-full rounded-xl text-sm"
            >
              {SOURCE_OPTIONS.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </motion.div>
  );
}
