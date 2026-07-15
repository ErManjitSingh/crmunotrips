import { RotateCcw, Search, SlidersHorizontal } from 'lucide-react';
import { PAYMENT_METHODS, PAYMENT_STATUSES } from './constants';
import { cn } from '../../lib/utils';

export default function PaymentFilterBar({ filters, onChange, onReset, activeCount = 0 }) {
  const set = (key, value) => onChange({ ...filters, [key]: value });

  return (
    <div className="rounded-2xl border border-subtle bg-surface p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-content-primary">
          <SlidersHorizontal className="w-4 h-4 text-indigo-500" />
          Smart Filters
          {activeCount > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
              {activeCount} active
            </span>
          )}
        </div>
        <button type="button" onClick={onReset} className="btn-ghost text-xs gap-1.5 h-8 px-2.5">
          <RotateCcw className="w-3.5 h-3.5" />
          Reset
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        <div className="relative sm:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted" />
          <input
            className="input-premium pl-9"
            placeholder="Search customer, invoice, booking, phone, email..."
            value={filters.search}
            onChange={(e) => set('search', e.target.value)}
          />
        </div>

        <select className="input-premium" value={filters.status} onChange={(e) => set('status', e.target.value)}>
          <option value="">All Status</option>
          {PAYMENT_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        <select className="input-premium" value={filters.method} onChange={(e) => set('method', e.target.value)}>
          <option value="">Payment Mode</option>
          {PAYMENT_METHODS.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>

        <input
          className="input-premium"
          placeholder="Destination"
          value={filters.destination}
          onChange={(e) => set('destination', e.target.value)}
        />

        <div className="flex gap-2">
          <input
            className="input-premium"
            type="number"
            placeholder="Min ₹"
            value={filters.amountMin}
            onChange={(e) => set('amountMin', e.target.value)}
          />
          <input
            className="input-premium"
            type="number"
            placeholder="Max ₹"
            value={filters.amountMax}
            onChange={(e) => set('amountMax', e.target.value)}
          />
        </div>
      </div>

      {(filters.dateFrom || filters.dateTo) && (
        <div className={cn('flex flex-wrap gap-3')}>
          <input
            type="date"
            className="input-premium max-w-[180px]"
            value={filters.dateFrom}
            onChange={(e) => set('dateFrom', e.target.value)}
          />
          <input
            type="date"
            className="input-premium max-w-[180px]"
            value={filters.dateTo}
            onChange={(e) => set('dateTo', e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
