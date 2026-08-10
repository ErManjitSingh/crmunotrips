import { CalendarDays, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

function timeGreeting(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function formatPeriodChip(filters) {
  if (!filters?.dateFrom && !filters?.dateTo) return 'All Time';
  if (filters.dateFrom && filters.dateFrom === filters.dateTo) {
    const d = new Date(`${filters.dateFrom}T12:00:00`);
    return `Today: ${d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })}`;
  }
  return 'Custom Range';
}

export default function AdminDashboardGreeting({ filters, periodLabel, onOpenFilters }) {
  const { user } = useAuth();
  const firstName = (user?.name || 'Admin').split(' ')[0];
  const chip = periodLabel?.includes(' - ')
    ? formatPeriodChip(filters)
    : periodLabel || formatPeriodChip(filters);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-[26px] font-bold tracking-tight text-slate-900">
          {timeGreeting()}, {firstName}! 👋
        </h1>
        <p className="mt-1 text-[13px] text-slate-500">
          Here&apos;s what&apos;s happening with your business today.
        </p>
      </div>
      <button
        type="button"
        onClick={onOpenFilters}
        className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[13px] font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 sm:self-auto"
      >
        <CalendarDays className="h-4 w-4 text-violet-500" />
        <span>{chip}</span>
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
      </button>
    </div>
  );
}
