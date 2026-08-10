import { Link } from 'react-router-dom';
import Avatar from '../ui/Avatar';
import DashboardPanel from './DashboardPanel';
import { cn } from '../../lib/utils';

const STATUS_STYLE = {
  Excellent: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Good: 'bg-blue-50 text-blue-700 ring-blue-200',
  'Needs Attention': 'bg-orange-50 text-orange-700 ring-orange-200',
  Low: 'bg-red-50 text-red-700 ring-red-200',
  Inactive: 'bg-slate-100 text-slate-500 ring-slate-200',
};

export default function SalesTeamPerformanceTable({ data }) {
  const executives = (data?.executives || [])
    .slice(0, 6)
    .map((ex) => ({
      id: ex._id || ex.name,
      name: ex.name || 'Unknown',
      leads: Number(ex.leads ?? ex.assigned ?? 0),
      followUps: Number(ex.followUps ?? 0),
      quotes: Number(ex.quotes ?? 0),
      bookings: Number(ex.bookings ?? ex.converted ?? 0),
      status: ex.performanceStatus || 'Inactive',
    }));

  return (
    <DashboardPanel
      title="Sales Team Performance"
      subtitle="Today"
      className="h-full"
      action={
        <Link to="/team" className="text-xs font-semibold text-violet-600 hover:underline">
          View All
        </Link>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead>
            <tr className="border-b border-subtle text-[11px] uppercase tracking-wide text-content-muted">
              <th className="pb-2 font-semibold">Executive</th>
              <th className="pb-2 font-semibold text-right">Leads</th>
              <th className="pb-2 font-semibold text-right">Follow-ups</th>
              <th className="pb-2 font-semibold text-right">Quotes</th>
              <th className="pb-2 font-semibold text-right">Bookings</th>
              <th className="pb-2 font-semibold text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {executives.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-content-muted">
                  No executives found
                </td>
              </tr>
            ) : (
              executives.map((ex) => (
                <tr key={ex.id} className="border-b border-subtle/60 last:border-0">
                  <td className="py-2.5">
                    <div className="flex items-center gap-2">
                      <Avatar name={ex.name} size="sm" />
                      <span className="font-medium text-content-primary">{ex.name}</span>
                    </div>
                  </td>
                  <td className="py-2.5 text-right tabular-nums">{ex.leads}</td>
                  <td className="py-2.5 text-right tabular-nums">{ex.followUps}</td>
                  <td className="py-2.5 text-right tabular-nums">{ex.quotes}</td>
                  <td className="py-2.5 text-right tabular-nums">{ex.bookings}</td>
                  <td className="py-2.5 text-right">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset',
                        STATUS_STYLE[ex.status] || STATUS_STYLE.Inactive
                      )}
                    >
                      {ex.status}
                    </span>
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
