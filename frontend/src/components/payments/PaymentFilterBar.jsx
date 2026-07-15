import { Search, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { PAYMENT_METHODS, PAYMENT_STATUSES } from './constants';

export default function PaymentFilterBar({ filters, onChange, onReset, activeCount = 0 }) {
  const set = (key, value) => onChange({ ...filters, [key]: value });

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          className="w-full h-10 pl-10 pr-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400"
          placeholder="Search payment, invoice, customer..."
          value={filters.search}
          onChange={(e) => set('search', e.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
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

        <select
          className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20"
          value={filters.gateway || ''}
          onChange={(e) => set('gateway', e.target.value)}
        >
          <option value="">Gateways</option>
          <option value="razorpay">Razorpay</option>
          <option value="cashfree">Cashfree</option>
          <option value="stripe">Stripe</option>
          <option value="manual">Manual</option>
        </select>

        <input
          className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 w-[140px]"
          placeholder="Executives"
          value={filters.executive || ''}
          onChange={(e) => set('executive', e.target.value)}
        />

        <input
          className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 w-[130px]"
          placeholder="Branches"
          value={filters.branch || ''}
          onChange={(e) => set('branch', e.target.value)}
        />

        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 shadow-sm"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          More Filters
          {activeCount > 0 && (
            <span className="ml-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">
              {activeCount}
            </span>
          )}
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </button>
      </div>
    </div>
  );
}
