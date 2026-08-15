import { CalendarDays, Search, ChevronDown } from 'lucide-react';
import { ATTENDANCE_PRESETS } from './attendanceDateUtils';
import { cn } from '../../lib/utils';

export default function AttendanceFilterBar({
  preset,
  onPresetChange,
  customFrom,
  onCustomFromChange,
  rangeLabel,
  search,
  onSearchChange,
  branches = [],
  branchId,
  onBranchChange,
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative inline-flex min-w-[180px] items-center">
          <CalendarDays className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" />
          <input
            type="date"
            value={customFrom}
            onChange={(e) => onCustomFromChange(e.target.value)}
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/15"
            title={rangeLabel}
          />
        </label>

        <div className="flex flex-wrap gap-2">
          {ATTENDANCE_PRESETS.map((p) => {
            const active = preset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onPresetChange(p.id)}
                className={cn(
                  'h-10 rounded-xl px-4 text-sm font-semibold transition-colors',
                  active
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                    : 'border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-700'
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative">
        <select
          value={branchId || ''}
          onChange={(e) => onBranchChange?.(e.target.value)}
          className="h-11 w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 pr-10 text-sm font-medium text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/15"
        >
          <option value="">All Branches & Offices</option>
          {branches.map((b) => (
            <option key={b._id} value={b._id}>
              {b.name}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange?.(e.target.value)}
          placeholder="Search by name, department or role..."
          className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/15"
        />
      </div>
    </div>
  );
}
