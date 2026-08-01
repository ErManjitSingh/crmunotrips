import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Search, RotateCcw } from 'lucide-react';
import {
  DESTINATIONS,
  LEAD_STATUSES,
  TRAVEL_MONTHS,
  BUDGET_FILTER_OPTIONS,
  PRIORITY_FILTER_OPTIONS,
} from './constants';
import { INDIAN_STATES } from '../lead-wizard/constants';
import { LEAD_SOURCE_FILTER_OPTIONS } from '../../lib/leadSourceLabels';
import { useAuth } from '../../context/AuthContext';
import API from '../../api/axios';

const fieldClass =
  'h-10 w-full rounded-xl border border-subtle bg-slate-50 px-3 text-sm text-content-primary outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500/40';

function FieldLabel({ children }) {
  return (
    <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-content-muted">
      {children}
    </label>
  );
}

export default function LeadFilterBar({ filters, onChange, onApply, onReset, activeCount = 0 }) {
  const { user } = useAuth();
  const { availableBranches = [] } = useSelector((s) => s.branch);
  const [executives, setExecutives] = useState([]);
  const [teams, setTeams] = useState([]);
  const canFilterBranch = ['admin', 'lead_provider', 'hr_admin'].includes(user?.role);

  useEffect(() => {
    API.get('/sales-manager/executives', { skipSuccessToast: true, skipErrorToast: true })
      .then((res) => setExecutives(Array.isArray(res.data) ? res.data : []))
      .catch(() => setExecutives([]));
    API.get('/teams', { skipSuccessToast: true, skipErrorToast: true })
      .then((res) => setTeams(Array.isArray(res.data) ? res.data : []))
      .catch(() => setTeams([]));
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
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-content-primary">Filters</h3>
        {activeCount > 0 && (
          <span className="rounded-full bg-blue-500 px-2 py-0.5 text-[10px] font-bold text-white">
            {activeCount} active
          </span>
        )}
      </div>

      <div className="relative mb-3">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" />
        <input
          value={filters.search}
          onChange={(e) => set('search', e.target.value)}
          placeholder="Search customer, phone, email, lead ID..."
          className="h-10 w-full rounded-xl border border-subtle bg-slate-50 pl-10 pr-4 text-sm text-content-primary placeholder:text-content-muted outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500/40"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <div>
          <FieldLabel>Date From</FieldLabel>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => set('dateFrom', e.target.value)}
            className={fieldClass}
          />
        </div>
        <div>
          <FieldLabel>Date To</FieldLabel>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => set('dateTo', e.target.value)}
            className={fieldClass}
          />
        </div>
        <div>
          <FieldLabel>Source</FieldLabel>
          <select value={filters.source} onChange={(e) => set('source', e.target.value)} className={fieldClass}>
            <option value="">All Sources</option>
            {LEAD_SOURCE_FILTER_OPTIONS.filter((s) => s.value).map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel>Destination</FieldLabel>
          <select
            value={filters.destination}
            onChange={(e) => set('destination', e.target.value)}
            className={fieldClass}
          >
            <option value="">All Destinations</option>
            {DESTINATIONS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel>Executive</FieldLabel>
          <select value={filters.agent} onChange={(e) => set('agent', e.target.value)} className={fieldClass}>
            <option value="">All Executives</option>
            {executives.map((ex) => (
              <option key={ex._id} value={ex._id}>{ex.name}</option>
            ))}
          </select>
        </div>
        {canFilterBranch && (
          <div>
            <FieldLabel>Branch</FieldLabel>
            <select
              value={filters.branchId || ''}
              onChange={(e) => set('branchId', e.target.value)}
              className={fieldClass}
            >
              <option value="">All Branches</option>
              {availableBranches.map((b) => (
                <option key={b._id} value={b._id}>{b.name}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <FieldLabel>Team</FieldLabel>
          <select value={filters.teamId || ''} onChange={(e) => set('teamId', e.target.value)} className={fieldClass}>
            <option value="">All Teams</option>
            {teams.map((t) => (
              <option key={t._id} value={t._id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel>State</FieldLabel>
          <select value={filters.state || ''} onChange={(e) => set('state', e.target.value)} className={fieldClass}>
            <option value="">All States</option>
            {INDIAN_STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel>Priority</FieldLabel>
          <select
            value={filters.priority || ''}
            onChange={(e) => set('priority', e.target.value)}
            className={fieldClass}
          >
            {PRIORITY_FILTER_OPTIONS.map((p) => (
              <option key={p.value || 'all'} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel>Budget</FieldLabel>
          <select
            value={filters.budgetRange || ''}
            onChange={(e) => setBudgetRange(e.target.value)}
            className={fieldClass}
          >
            {BUDGET_FILTER_OPTIONS.map((b) => (
              <option key={b.value || 'all'} value={b.value}>{b.label}</option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel>Travel Month</FieldLabel>
          <select
            value={filters.travelMonth}
            onChange={(e) => set('travelMonth', e.target.value)}
            className={fieldClass}
          >
            <option value="">All Months</option>
            {TRAVEL_MONTHS.map((m, i) => (
              <option key={m} value={i}>{m}</option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel>Lead Status</FieldLabel>
          <select value={filters.status} onChange={(e) => set('status', e.target.value)} className={fieldClass}>
            <option value="">All Statuses</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-subtle pt-4">
        <button
          type="button"
          onClick={onApply}
          className="h-10 rounded-xl bg-blue-500 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-600"
        >
          Apply Filters
        </button>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-subtle bg-white px-4 text-sm font-medium text-content-primary transition-colors hover:bg-slate-50"
        >
          <RotateCcw className="h-4 w-4 text-content-muted" />
          Reset
        </button>
      </div>
    </div>
  );
}
