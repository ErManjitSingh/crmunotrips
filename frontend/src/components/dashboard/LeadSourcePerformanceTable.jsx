import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import DashboardPanel from './DashboardPanel';

function formatSource(name) {
  return String(name || 'Other')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function LeadSourcePerformanceTable({ data = [] }) {
  const rows = (data || [])
    .map((item) => ({
      source: formatSource(item.name || item.label || item.key),
      leads: Number(item.value ?? item.total ?? item.leads ?? 0),
      connected: Number(item.connected || 0),
      bookings: Number(item.bookings ?? item.converted ?? 0),
      conv:
        item.convPct ??
        item.conversionRate ??
        (item.value || item.total
          ? Math.round(
              ((item.bookings ?? item.converted ?? 0) / (item.value || item.total || 1)) * 1000
            ) / 10
          : 0),
    }))
    .filter((r) => r.leads > 0)
    .sort((a, b) => b.leads - a.leads)
    .slice(0, 6);

  return (
    <DashboardPanel
      title="Lead Source Performance"
      subtitle="Leads · Connected · Bookings"
      className="h-full"
      action={
        <Link
          to="/reports"
          className="inline-flex items-center gap-1 text-xs font-semibold text-violet-600 hover:underline"
        >
          View Full Report <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[280px] text-left text-sm">
          <thead>
            <tr className="border-b border-subtle text-[11px] uppercase tracking-wide text-content-muted">
              <th className="pb-2 font-semibold">Source</th>
              <th className="pb-2 font-semibold text-right">Leads</th>
              <th className="pb-2 font-semibold text-right">Connected</th>
              <th className="pb-2 font-semibold text-right">Bookings</th>
              <th className="pb-2 font-semibold text-right">Conv. %</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-content-muted">
                  No source data
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.source} className="border-b border-subtle/60 last:border-0">
                  <td className="py-2.5 font-medium text-content-primary">{row.source}</td>
                  <td className="py-2.5 text-right tabular-nums">{row.leads}</td>
                  <td className="py-2.5 text-right tabular-nums">{row.connected}</td>
                  <td className="py-2.5 text-right tabular-nums">{row.bookings}</td>
                  <td className="py-2.5 text-right font-semibold text-violet-600 tabular-nums">
                    {row.conv}%
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </DashboardPanel>
  );
}
