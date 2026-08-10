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

export default function AdminDashboardGreeting({ filters, periodLabel }) {
  const { user } = useAuth();
  const firstName = (user?.name || 'Admin').split(' ')[0];
  const chip = periodLabel || formatPeriodChip(filters);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-content-primary">
          {timeGreeting()}, {firstName}! 👋
        </h1>
        <p className="mt-1 text-sm text-content-muted">
          Here&apos;s your business overview — Contacted and Qualified stay separate in the funnel.
        </p>
      </div>
      <div className="inline-flex items-center gap-2 self-start rounded-xl border border-subtle bg-surface px-3 py-2 text-sm font-medium text-content-secondary shadow-sm sm:self-auto">
        <CalendarDays className="h-4 w-4 text-violet-500" />
        <span>{chip}</span>
        <ChevronDown className="h-3.5 w-3.5 text-content-muted" />
      </div>
    </div>
  );
}
