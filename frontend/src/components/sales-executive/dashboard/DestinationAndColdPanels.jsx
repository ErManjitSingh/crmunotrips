import { Link } from 'react-router-dom';
import { PhoneCall, MapPin } from 'lucide-react';
import { formatFollowUpDate } from '../executiveUtils';

const PERIODS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7d', label: '7 Days' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'all', label: 'All Time' },
];

export function ColdCallAlertsPanel({ items = [], onMarkDone }) {
  if (!items.length) return null;

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500 text-white">
          <PhoneCall className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-red-700">Next cold call due</h3>
          <p className="text-[11px] text-red-600/80">Red alerts stay until you mark call done</p>
        </div>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item._id}
            className="flex flex-col gap-2 rounded-lg border border-red-200 bg-white px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <Link
                to={`/sales-executive/leads/${item._id}/view`}
                className="truncate text-sm font-semibold text-red-700 hover:underline"
              >
                {item.name}
              </Link>
              <p className="truncate text-[11px] text-red-600/80">
                {item.destination || 'No destination'}
                {item.coldReason ? ` · ${item.coldReason.replace(/_/g, ' ')}` : ''}
                {item.scheduledAt ? ` · ${formatFollowUpDate(item.scheduledAt)}` : ''}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Link
                to={`/sales-executive/leads/${item._id}/view`}
                className="rounded-lg border border-red-200 px-2.5 py-1.5 text-[11px] font-semibold text-red-700 hover:bg-red-50"
              >
                Open
              </Link>
              {onMarkDone && (
                <button
                  type="button"
                  onClick={() => onMarkDone(item)}
                  className="rounded-lg bg-red-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-red-500"
                >
                  Call Done
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DestinationWisePanel({
  rows = [],
  period = 'all',
  onPeriodChange,
}) {
  return (
    <div className="flex h-full min-h-[320px] flex-col rounded-xl border border-subtle bg-white p-3.5 shadow-sm dark:bg-slate-900/80">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
            <MapPin className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-content-primary">Destination-wise Leads</h3>
            <p className="text-[11px] text-content-muted">Count, conversions by destination</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => onPeriodChange?.(p.value)}
              className={`rounded-lg px-2.5 py-1 text-[10px] font-semibold transition-colors ${
                period === p.value
                  ? 'bg-violet-600 text-white'
                  : 'bg-surface-elevated text-content-muted hover:text-content-primary'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {!rows.length ? (
        <p className="flex flex-1 items-center justify-center py-8 text-center text-xs text-content-muted">
          No leads for this period
        </p>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="min-w-full text-left text-[11px]">
            <thead className="sticky top-0 bg-white dark:bg-slate-900/95">
              <tr className="border-b border-subtle text-content-muted">
                <th className="px-2 py-2 font-semibold">Destination</th>
                <th className="px-2 py-2 font-semibold text-right">Leads</th>
                <th className="px-2 py-2 font-semibold text-right">Converted</th>
                <th className="px-2 py-2 font-semibold text-right">Conv %</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.destination} className="border-b border-subtle/70 last:border-0">
                  <td className="px-2 py-2 font-semibold text-content-primary">{row.destination}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{row.total}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-emerald-600">{row.converted}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-violet-600">{row.conversionRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
