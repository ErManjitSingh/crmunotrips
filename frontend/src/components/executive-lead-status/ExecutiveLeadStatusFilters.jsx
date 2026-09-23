import { useState } from 'react';
import { useSelector } from 'react-redux';
import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import { cn } from '../../lib/utils';
import PeriodPresetChips from '../ui/PeriodPresetChips';
import { LEAD_SOURCE_FILTER_OPTIONS } from '../../lib/leadSourceLabels';
import { isDateRangeInvalid } from '../../lib/executiveLeadStatusFilters';
import { useExecutiveFilterOptions } from '../../features/leads/hooks/useExecutiveLeadStatusQuery';

const fieldClass =
  'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-violet-500/25 focus:border-violet-400';

function FieldLabel({ htmlFor, children }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-500">
      {children}
    </label>
  );
}

/**
 * Filters for the Executive Lead Status report: Period (chips + Date From / Date To), Source,
 * Executive and Branch. Deliberately has no Destination or Package Cost — they don't apply to an
 * assignment-cohort report. Period chips apply immediately; the other controls apply on "Apply".
 */
export default function ExecutiveLeadStatusFilters({ filters, onChange, onApply, onReset, onPeriodSelect }) {
  const { availableBranches, selectedBranchId } = useSelector((state) => state.branch);
  const { data: executives = [], isLoading: executivesLoading } = useExecutiveFilterOptions(filters.branchId);

  const set = (key, value) => onChange({ ...filters, [key]: value });
  // The executive list is branch-specific, so a branch change clears a now-possibly-invalid executive.
  const setBranch = (branchId) => onChange({ ...filters, branchId, executiveId: '' });

  // Below lg the field filters collapse behind a toggle so results are not pushed off-screen.
  const [expanded, setExpanded] = useState(false);
  const rangeInvalid = isDateRangeInvalid(filters);
  const activeBranch = availableBranches.find((branch) => branch._id === selectedBranchId);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!rangeInvalid) onApply();
      }}
      className="mb-4 rounded-2xl border border-subtle bg-white p-3.5 shadow-sm"
    >
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Assigned</span>
        <PeriodPresetChips
          dateFrom={filters.dateFrom}
          dateTo={filters.dateTo}
          onSelect={onPeriodSelect}
          accent="violet"
          colorful
        />
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded((open) => !open)}
            aria-expanded={expanded}
            aria-controls="els-filter-fields"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 lg:hidden"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters
          </button>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
          <button
            type="submit"
            disabled={rangeInvalid}
            className="h-9 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 text-sm font-semibold text-white shadow-md shadow-violet-500/30 transition hover:from-violet-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Apply
          </button>
        </div>
      </div>

      <div
        id="els-filter-fields"
        className={cn(
          'grid-cols-1 gap-3 sm:grid-cols-2 lg:grid lg:grid-cols-3 xl:grid-cols-5',
          expanded || rangeInvalid ? 'grid' : 'hidden'
        )}
      >
        <div>
          <FieldLabel htmlFor="els-date-from">Date From</FieldLabel>
          <input
            id="els-date-from"
            type="date"
            value={filters.dateFrom}
            max={filters.dateTo || undefined}
            onChange={(event) => set('dateFrom', event.target.value)}
            className={fieldClass}
          />
        </div>
        <div>
          <FieldLabel htmlFor="els-date-to">Date To</FieldLabel>
          <input
            id="els-date-to"
            type="date"
            value={filters.dateTo}
            min={filters.dateFrom || undefined}
            onChange={(event) => set('dateTo', event.target.value)}
            className={fieldClass}
          />
        </div>
        <div>
          <FieldLabel htmlFor="els-source">Source</FieldLabel>
          <select
            id="els-source"
            value={filters.source}
            onChange={(event) => set('source', event.target.value)}
            className={fieldClass}
          >
            <option value="">All Sources</option>
            {LEAD_SOURCE_FILTER_OPTIONS.filter((option) => option.value).map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel htmlFor="els-executive">Executive</FieldLabel>
          <select
            id="els-executive"
            value={filters.executiveId}
            onChange={(event) => set('executiveId', event.target.value)}
            disabled={executivesLoading}
            className={fieldClass}
          >
            <option value="">All Executives</option>
            {executives.map((executive) => (
              <option key={executive._id} value={executive._id}>{executive.name}</option>
            ))}
          </select>
        </div>
        {availableBranches.length > 1 && (
          <div>
            <FieldLabel htmlFor="els-branch">Branch</FieldLabel>
            <select
              id="els-branch"
              value={filters.branchId}
              onChange={(event) => setBranch(event.target.value)}
              className={fieldClass}
            >
              <option value="">{activeBranch ? `Active branch (${activeBranch.name})` : 'Active branch'}</option>
              {availableBranches.map((branch) => (
                <option key={branch._id} value={branch._id}>{branch.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {rangeInvalid && (
        <p role="alert" className="mt-3 text-xs font-medium text-rose-600">
          Date From must not be after Date To.
        </p>
      )}
    </form>
  );
}
