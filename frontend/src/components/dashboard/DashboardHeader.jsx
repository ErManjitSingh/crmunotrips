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
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    dateFrom: toInputDate(from),
    dateTo: toInputDate(now),
    source: '',
  };
}

export default function DashboardHeader({
  filters,
  onFiltersChange,
  onRefresh,
  isRefreshing = false,
  periodLabel,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border border-subtle bg-surface shadow-sm"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(59,130,246,0.08),_transparent_55%),radial-gradient(ellipse_at_bottom_left,_rgba(16,185,129,0.06),_transparent_50%)]" />
      <div className="relative flex flex-col gap-5 p-5 lg:flex-row lg:items-end lg:justify-between lg:p-6">
        <div className="min-w-0">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
            <Megaphone className="h-3.5 w-3.5" />
            Admin Insights
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-content-primary sm:text-[30px] sm:leading-tight">
            Lead Management Report
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-content-secondary">
            Overview of leads &amp; conversions performance
            {periodLabel ? (
              <span className="text-content-muted"> · {periodLabel}</span>
            ) : null}
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2.5">
          <label className="flex min-w-[148px] flex-col gap-1">
            <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-content-muted">
              <Calendar className="h-3 w-3" /> From
            </span>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => onFiltersChange({ ...filters, dateFrom: e.target.value })}
              className="input-premium h-10 rounded-xl text-sm"
            />
          </label>
          <label className="flex min-w-[148px] flex-col gap-1">
            <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-content-muted">
              <Calendar className="h-3 w-3" /> To
            </span>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => onFiltersChange({ ...filters, dateTo: e.target.value })}
              className="input-premium h-10 rounded-xl text-sm"
            />
          </label>
          <label className="flex min-w-[160px] flex-col gap-1">
            <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-content-muted">
              <Filter className="h-3 w-3" /> Source
            </span>
            <select
              value={filters.source}
              onChange={(e) => onFiltersChange({ ...filters, source: e.target.value })}
              className="input-premium h-10 rounded-xl text-sm"
            >
              {SOURCE_OPTIONS.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className={cn(
                'inline-flex h-10 items-center gap-2 rounded-xl border border-subtle bg-surface px-4 text-sm font-semibold text-content-primary transition-colors hover:bg-surface-elevated',
                'disabled:opacity-70'
              )}
            >
              <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
              Refresh
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
