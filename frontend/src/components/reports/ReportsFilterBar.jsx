import { Calendar, MapPin, Megaphone, User, Package, RotateCcw } from 'lucide-react';
import { Button } from '../ui/button';
import { DESTINATION_OPTIONS, EXECUTIVE_OPTIONS, FILTER_DEFAULTS, SOURCE_OPTIONS } from './constants';
import PeriodPresetChips from '../ui/PeriodPresetChips';
import { applyPeriodPreset } from '../../lib/periodFilters';

export default function ReportsFilterBar({ filters, onChange, onReset, onPeriodSelect }) {
  return (
    <div className="sticky top-16 z-20 mb-6 rounded-2xl border border-subtle bg-surface/90 backdrop-blur-md p-4 shadow-sm">
      <div className="mb-3">
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-content-muted">Period</p>
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
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-[10px] uppercase font-medium text-content-muted mb-1 flex items-center gap-1"><Calendar className="w-3 h-3" /> From</label>
          <input type="date" value={filters.dateFrom} onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })} className="input-premium h-9 rounded-lg text-sm w-[140px]" />
        </div>
        <div>
          <label className="text-[10px] uppercase font-medium text-content-muted mb-1 flex items-center gap-1"><Calendar className="w-3 h-3" /> To</label>
          <input type="date" value={filters.dateTo} onChange={(e) => onChange({ ...filters, dateTo: e.target.value })} className="input-premium h-9 rounded-lg text-sm w-[140px]" />
        </div>
        <div>
          <label className="text-[10px] uppercase font-medium text-content-muted mb-1 flex items-center gap-1"><MapPin className="w-3 h-3" /> Destination</label>
          <select value={filters.destination} onChange={(e) => onChange({ ...filters, destination: e.target.value })} className="input-premium h-9 rounded-lg text-sm min-w-[130px]">
            <option value="">All</option>
            {DESTINATION_OPTIONS.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase font-medium text-content-muted mb-1 flex items-center gap-1"><Megaphone className="w-3 h-3" /> Source</label>
          <select value={filters.source} onChange={(e) => onChange({ ...filters, source: e.target.value })} className="input-premium h-9 rounded-lg text-sm min-w-[130px]">
            <option value="">All</option>
            {SOURCE_OPTIONS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase font-medium text-content-muted mb-1 flex items-center gap-1"><User className="w-3 h-3" /> Executive</label>
          <select value={filters.executive} onChange={(e) => onChange({ ...filters, executive: e.target.value })} className="input-premium h-9 rounded-lg text-sm min-w-[140px]">
            <option value="">All</option>
            {EXECUTIVE_OPTIONS.map((e) => <option key={e}>{e}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase font-medium text-content-muted mb-1 flex items-center gap-1"><Package className="w-3 h-3" /> Package</label>
          <input value={filters.package} onChange={(e) => onChange({ ...filters, package: e.target.value })} placeholder="Search package..." className="input-premium h-9 rounded-lg text-sm min-w-[140px]" />
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => onReset()} className="rounded-lg h-9 gap-1.5 ml-auto">
          <RotateCcw className="w-3.5 h-3.5" /> Reset
        </Button>
      </div>
    </div>
  );
}

export { FILTER_DEFAULTS };
