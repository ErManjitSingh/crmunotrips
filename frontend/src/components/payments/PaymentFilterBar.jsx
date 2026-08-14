import { RotateCcw, Search } from 'lucide-react';
import { PAYMENT_METHODS, PAYMENT_STATUSES } from './constants';
import PeriodPresetChips from '../ui/PeriodPresetChips';
import { applyPeriodPreset } from '../../lib/periodFilters';

export default function PaymentFilterBar({ filters, onChange, onReset, activeCount = 0, onPeriodSelect }) {
  const set = (key, value) => onChange({ ...filters, [key]: value });

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="relative min-w-0 flex-1 xl:max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="w-full h-10 pl-10 pr-3 rounded-xl border border-slate-200 bg-slate-50/70 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
            placeholder="Search payment, invoice, customer..."
            value={filters.search}
            onChange={(e) => set('search', e.target.value)}
          />
        </div>

        <PeriodPresetChips
          dateFrom={filters.dateFrom}
          dateTo={filters.dateTo}
          onSelect={(key) => {
            const dates = applyPeriodPreset(key);
            onChange({ ...filters, ...dates, datePreset: key === 'all' ? '' : key });
            onPeriodSelect?.(key);
          }}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        <select
          className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
          value={filters.status}
          onChange={(e) => set('status', e.target.value)}
        >
          <option value="">Status</option>
          {PAYMENT_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        <select
          className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
          value={filters.method}
          onChange={(e) => set('method', e.target.value)}
        >
          <option value="">Payment Modes</option>
          {PAYMENT_METHODS.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>

        <input
          className="h-10 w-[150px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
          placeholder="Destination"
          value={filters.destination || ''}
          onChange={(e) => set('destination', e.target.value)}
        />

        <input
          className="h-10 w-[150px] rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
          placeholder="Executive"
          value={filters.executive || ''}
          onChange={(e) => set('executive', e.target.value)}
        />

        {activeCount > 0 && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
            <span className="ml-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">
              {activeCount}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
