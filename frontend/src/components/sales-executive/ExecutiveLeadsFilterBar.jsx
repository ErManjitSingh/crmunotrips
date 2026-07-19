import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, SlidersHorizontal, Plus } from 'lucide-react';
import { LEAD_STATUSES, DESTINATIONS } from '../leads/constants';
import { executiveInput } from './executivePageStyles';

const PRIORITY_OPTIONS = [
  { value: '', label: 'All priorities' },
  { value: 'hot', label: 'Hot leads' },
  { value: 'high', label: 'High priority' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export default function ExecutiveLeadsFilterBar({
  search,
  onSearchChange,
  statusFilter,
  onStatusChange,
  destinationFilter,
  onDestinationChange,
  priorityFilter,
  onPriorityChange,
  showAddLead = true,
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeExtraFilters = statusFilter || destinationFilter || priorityFilter;

  return (
    <div className="rounded-2xl border border-subtle bg-white dark:bg-slate-900 shadow-sm p-4">
      <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by name, destination, phone…"
            className={`w-full h-10 pl-10 pr-4 ${executiveInput}`}
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value)}
          className={`h-10 px-3 min-w-[140px] ${executiveInput}`}
        >
          <option value="">All statuses</option>
          {LEAD_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        <select
          value={destinationFilter}
          onChange={(e) => onDestinationChange(e.target.value)}
          className={`h-10 px-3 min-w-[150px] ${executiveInput}`}
        >
          <option value="">All destinations</option>
          {DESTINATIONS.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        <select
          value={priorityFilter}
          onChange={(e) => onPriorityChange(e.target.value)}
          className={`h-10 px-3 min-w-[140px] ${executiveInput}`}
        >
          {PRIORITY_OPTIONS.map((p) => (
            <option key={p.value || 'all'} value={p.value}>{p.label}</option>
          ))}
        </select>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setFiltersOpen(!filtersOpen)}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-subtle bg-white dark:bg-slate-900 text-sm font-medium text-content-primary hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <SlidersHorizontal className="w-4 h-4 text-content-muted" />
            Filters
            {activeExtraFilters && (
              <span className="ml-0.5 px-1.5 py-0.5 text-[10px] bg-[#5D5FEF] text-white rounded-full font-bold">
                !
              </span>
            )}
          </button>

          {showAddLead && (
            <Link
              to="/sales-executive/leads/add"
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-[#5D5FEF] hover:bg-[#4F51E0] text-white text-sm font-semibold shadow-md shadow-[#5D5FEF]/25 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Lead
            </Link>
          )}
        </div>
      </div>

      {filtersOpen && activeExtraFilters && (
        <div className="mt-3 pt-3 border-t border-subtle flex justify-end">
          <button
            type="button"
            onClick={() => {
              onStatusChange('');
              onDestinationChange('');
              onPriorityChange('');
            }}
            className="text-sm font-medium text-[#5D5FEF] hover:text-[#4F51E0]"
          >
            Clear all filters
          </button>
        </div>
      )}
    </div>
  );
}
