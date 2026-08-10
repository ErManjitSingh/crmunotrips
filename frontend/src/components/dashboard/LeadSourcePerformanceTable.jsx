import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import DashboardPanel from './DashboardPanel';

function formatSource(name) {
  const key = String(name || 'other').toLowerCase().replace(/\s+/g, '_');
  const labels = {
    dpw: 'DPW',
    dpw_wa: 'DPW WA',
    dpw_call: 'DPW CALL',
    dpw2: 'DPW2',
    dpw2_wa: 'DPW2 WA',
    dpw2_call: 'DPW2 CALL',
    referral: 'Referral',
    call_lead: 'Call Lead',
    organic: 'Organic',
  };
  return labels[key] || String(name || 'Other').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
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
    <DashboardPanel title="Lead Source Performance" className="h-full">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[280px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              <th className="pb-2.5 font-semibold">Source</th>
              <th className="pb-2.5 text-right font-semibold">Leads</th>
              <th className="pb-2.5 text-right font-semibold">Connected</th>
              <th className="pb-2.5 text-right font-semibold">Bookings</th>
              <th className="pb-2.5 text-right font-semibold">Conv. %</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400">
                  No source data
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.source} className="border-b border-slate-50 last:border-0">
                  <td className="py-2.5 font-medium text-slate-700">{row.source}</td>
                  <td className="py-2.5 text-right tabular-nums text-slate-700">{row.leads}</td>
                  <td className="py-2.5 text-right tabular-nums text-slate-700">{row.connected}</td>
                  <td className="py-2.5 text-right tabular-nums text-slate-700">{row.bookings}</td>
                  <td className="py-2.5 text-right font-semibold tabular-nums text-violet-600">
                    {row.conv}%
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Link
        to="/reports"
        className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-violet-600 hover:underline"
      >
        View Full Report <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </DashboardPanel>
  );
}
