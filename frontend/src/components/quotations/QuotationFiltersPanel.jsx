import { Filter, RefreshCw, Search, X } from 'lucide-react';
import { Button } from '../ui/button';
import { DESTINATIONS } from '../leads/constants';
import { cn } from '../../lib/utils';
import PeriodPresetChips from '../ui/PeriodPresetChips';
import { applyPeriodPreset } from '../../lib/periodFilters';

export default function QuotationFiltersPanel({
  filters,
  onChange,
  onApply,
  onClear,
  onRefresh,
  hasActiveFilters = false,
  showStatusFilter = false,
  showExecutiveFilter = false,
  statusOptions = [],
  executives = [],
  segmentLabel,
  className,
  onPeriodSelect,
}) {
  const set = (key, val) => onChange({ ...filters, [key]: val });

  return (
    <div className={cn('rounded-2xl border border-indigo-500/20 bg-surface/80 p-3 shadow-sm', className)}>
      <div className="mb-2.5">
        <PeriodPresetChips
          dateFrom={filters.dateFrom}
          dateTo={filters.dateTo}
          onSelect={(key) => {
            const dates = applyPeriodPreset(key);
            onChange({ ...filters, ...dates });
            onPeriodSelect?.(key);
          }}
        />
      </div>
      <div className="flex items-center gap-2 overflow-x-auto flex-nowrap">
        <div className="flex items-center gap-1.5 shrink-0 text-sm font-medium text-content-primary">
          <Filter className="w-4 h-4 text-indigo-600" />
          <span className="hidden sm:inline">Filters</span>
          {segmentLabel && (
            <span className="text-[10px] font-medium uppercase px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-700 ring-1 ring-indigo-500/25 whitespace-nowrap">
              {segmentLabel}
            </span>
          )}
          {hasActiveFilters && (
            <span className="text-[10px] font-medium uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 ring-1 ring-amber-500/25 whitespace-nowrap">
              Active
            </span>
          )}
        </div>

        <div className="relative shrink-0 w-44 sm:w-52 lg:w-60">
          <Search className="w-4 h-4 text-indigo-600/70 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            value={filters.search}
            onChange={(e) => set('search', e.target.value)}
            placeholder="Search quote #, customer…"
            className="w-full h-9 pl-9 pr-3 rounded-xl border border-indigo-500/20 bg-surface text-sm outline-none focus:ring-2 focus:ring-indigo-500/35"
          />
        </div>

        {showStatusFilter && (
          <select
            value={filters.status}
            onChange={(e) => set('status', e.target.value)}
            className="input-premium h-9 w-32 shrink-0 text-sm"
            title="Status"
          >
            {statusOptions.map((s) => (
              <option key={s.value || 'all'} value={s.value}>{s.label}</option>
            ))}
          </select>
        )}

        <select
          value={filters.destination}
          onChange={(e) => set('destination', e.target.value)}
          className="input-premium h-9 w-36 shrink-0 text-sm"
          title="Destination"
        >
          <option value="">All destinations</option>
          {DESTINATIONS.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        {showExecutiveFilter && (
          <select
            value={filters.executiveId}
            onChange={(e) => set('executiveId', e.target.value)}
            className="input-premium h-9 w-36 shrink-0 text-sm"
            title="Executive"
          >
            <option value="">All executives</option>
            {executives.map((ex) => (
              <option key={ex._id} value={ex._id}>{ex.name}</option>
            ))}
          </select>
        )}

        <input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => set('dateFrom', e.target.value)}
          className="input-premium h-9 w-36 shrink-0 text-sm"
          title="From date"
        />

        <input
          type="date"
          value={filters.dateTo}
          onChange={(e) => set('dateTo', e.target.value)}
          className="input-premium h-9 w-36 shrink-0 text-sm"
          title="To date"
        />

        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          {onApply && (
            <Button size="sm" onClick={onApply} className="h-9 px-3 rounded-xl whitespace-nowrap">
              Apply
            </Button>
          )}
          {onRefresh && (
            <Button variant="outline" size="sm" onClick={onRefresh} className="h-9 gap-1 whitespace-nowrap">
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          )}
          {hasActiveFilters && onClear && (
            <Button variant="ghost" size="sm" onClick={onClear} className="h-9 gap-1 text-content-muted whitespace-nowrap">
              <X className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clear</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
