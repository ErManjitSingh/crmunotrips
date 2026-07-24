import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, SlidersHorizontal, RotateCcw, ChevronDown } from 'lucide-react';
import { DESTINATIONS, LEAD_STATUSES, TRAVEL_MONTHS, BUDGET_FILTER_OPTIONS } from './constants';
import { LEAD_SOURCE_FILTER_OPTIONS } from '../../lib/leadSourceLabels';
import API from '../../api/axios';

export default function LeadFilterBar({ filters, onChange, onApply, onReset, activeCount = 0 }) {
  const [expanded, setExpanded] = useState(false);
  const [executives, setExecutives] = useState([]);

  useEffect(() => {
    API.get('/sales-manager/executives', { skipSuccessToast: true, skipErrorToast: true })
      .then((res) => setExecutives(Array.isArray(res.data) ? res.data : []))
      .catch(() => setExecutives([]));
  }, []);

  const set = (key, val) => onChange({ ...filters, [key]: val });

  const setBudgetRange = (value) => {
    const opt = BUDGET_FILTER_OPTIONS.find((o) => o.value === value);
    onChange({
      ...filters,
      budgetRange: value,
      budgetMin: opt?.min ?? '',
      budgetMax: opt?.max ?? '',
    });
  };

  return (
    <div className="mb-4 rounded-2xl border border-subtle bg-white p-4 shadow-sm">
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted" />
          <input
            value={filters.search}
            onChange={(e) => set('search', e.target.value)}
            placeholder="Search customer, phone, email, lead ID..."
            className="w-full h-10 pl-10 pr-4 rounded-xl border border-subtle bg-slate-50 text-sm text-content-primary placeholder:text-content-muted outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500/40 transition-all"
          />
        </div>
        <select
          value={filters.status}
          onChange={(e) => set('status', e.target.value)}
          className="h-10 rounded-xl border border-subtle bg-slate-50 px-3 text-sm text-content-primary outline-none focus:ring-2 focus:ring-blue-500/25 lg:w-40"
        >
          <option value="">All Statuses</option>
          {LEAD_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select
          value={filters.budgetRange || ''}
          onChange={(e) => setBudgetRange(e.target.value)}
          className="h-10 rounded-xl border border-subtle bg-slate-50 px-3 text-sm text-content-primary outline-none focus:ring-2 focus:ring-blue-500/25 lg:w-40"
        >
          {BUDGET_FILTER_OPTIONS.map((b) => (
            <option key={b.value || 'all'} value={b.value}>{b.label}</option>
          ))}
        </select>
        <select
          value={filters.agent}
          onChange={(e) => set('agent', e.target.value)}
          className="h-10 rounded-xl border border-subtle bg-slate-50 px-3 text-sm text-content-primary outline-none focus:ring-2 focus:ring-blue-500/25 lg:w-44"
        >
          <option value="">All Executives</option>
          {executives.map((ex) => (
            <option key={ex._id} value={ex._id}>{ex.name}</option>
          ))}
        </select>
        <select
          value={filters.source}
          onChange={(e) => set('source', e.target.value)}
          className="h-10 rounded-xl border border-subtle bg-slate-50 px-3 text-sm text-content-primary outline-none focus:ring-2 focus:ring-blue-500/25 lg:w-36"
        >
          <option value="">All Sources</option>
          {LEAD_SOURCE_FILTER_OPTIONS.filter((s) => s.value).map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <select
          value={filters.destination}
          onChange={(e) => set('destination', e.target.value)}
          className="h-10 rounded-xl border border-subtle bg-slate-50 px-3 text-sm text-content-primary outline-none focus:ring-2 focus:ring-blue-500/25 lg:w-40"
        >
          <option value="">All Destinations</option>
          {DESTINATIONS.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onApply}
            className="h-10 px-5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold shadow-sm transition-colors flex-1 lg:flex-none"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl border border-subtle bg-white text-sm font-medium text-content-primary hover:bg-slate-50 transition-colors"
          >
            <SlidersHorizontal className="w-4 h-4 text-content-muted" />
            <span className="hidden sm:inline">More</span>
            {activeCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 text-[10px] bg-blue-500 text-white rounded-full font-bold">{activeCount}</span>
            )}
            <ChevronDown className={`w-3.5 h-3.5 text-content-muted transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center justify-center h-10 w-10 rounded-xl border border-subtle bg-white text-content-muted hover:bg-slate-50 hover:text-content-primary transition-colors"
            title="Reset filters"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3 pt-4 mt-4 border-t border-subtle">
              <select value={filters.travelMonth} onChange={(e) => set('travelMonth', e.target.value)} className="h-10 rounded-xl border border-subtle bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/25">
                <option value="">Travel Month</option>
                {TRAVEL_MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
              <input type="number" placeholder="Min Budget ₹" value={filters.budgetMin} onChange={(e) => onChange({ ...filters, budgetMin: e.target.value, budgetRange: '' })} className="h-10 rounded-xl border border-subtle bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/25" />
              <input type="number" placeholder="Max Budget ₹" value={filters.budgetMax} onChange={(e) => onChange({ ...filters, budgetMax: e.target.value, budgetRange: '' })} className="h-10 rounded-xl border border-subtle bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/25" />
              <input type="date" value={filters.dateFrom} onChange={(e) => set('dateFrom', e.target.value)} className="h-10 rounded-xl border border-subtle bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/25" title="From date" />
              <input type="date" value={filters.dateTo} onChange={(e) => set('dateTo', e.target.value)} className="h-10 rounded-xl border border-subtle bg-slate-50 px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/25" title="To date" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
