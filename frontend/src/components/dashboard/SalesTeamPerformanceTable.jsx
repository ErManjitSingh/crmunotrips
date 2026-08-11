import { Link } from 'react-router-dom';
import Avatar from '../ui/Avatar';
import DashboardPanel from './DashboardPanel';
import { cn } from '../../lib/utils';

const STATUS_STYLE = {
  Excellent: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  Good: 'bg-sky-50 text-sky-700 ring-sky-200',
  'Needs Attention': 'bg-amber-50 text-amber-800 ring-amber-200',
  Low: 'bg-rose-50 text-rose-700 ring-rose-200',
  Inactive: 'bg-slate-100 text-slate-500 ring-slate-200',
};

const STATUS_LABEL = {
  Excellent: 'Excellent',
  Good: 'Good',
  'Needs Attention': 'Focus',
  Low: 'Low',
  Inactive: 'Inactive',
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
      title="Sales Team Performance (Today)"
      className="h-full"
      action={
        <Link to="/team" className="text-xs font-semibold text-violet-600 hover:underline">
          View All
        </Link>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">
              <th className="rounded-l-lg py-2 pl-2.5 pr-2 font-semibold">Team Member</th>
              <th className="px-1.5 py-2 text-right font-semibold">Leads</th>
              <th className="px-1.5 py-2 text-right font-semibold">Follow-ups</th>
              <th className="px-1.5 py-2 text-right font-semibold">Quotations</th>
              <th className="px-1.5 py-2 text-right font-semibold">Bookings</th>
              <th className="rounded-r-lg py-2 pl-1.5 pr-2.5 text-right font-semibold">Performance</th>
            </tr>
          </thead>
          <tbody>
            {executives.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  No executives found
                </td>
              </tr>
            ) : (
              executives.map((ex) => (
                <tr
                  key={ex.id}
                  className="border-b border-slate-100 last:border-0 hover:bg-violet-50/40"
                >
                  <td className="py-2 pl-2.5 pr-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <Avatar name={ex.name} size="sm" className="!h-7 !w-7 !text-[10px]" />
                      <span className="truncate font-medium text-slate-800">{ex.name}</span>
                    </div>
                  </td>
                  <td className="px-1.5 py-2 text-right tabular-nums text-slate-700">{ex.leads}</td>
                  <td className="px-1.5 py-2 text-right tabular-nums text-slate-700">{ex.followUps}</td>
                  <td className="px-1.5 py-2 text-right tabular-nums text-slate-700">{ex.quotes}</td>
                  <td className="px-1.5 py-2 text-right font-semibold tabular-nums text-violet-700">
                    {ex.bookings}
                  </td>
                  <td className="py-2 pl-1.5 pr-2.5 text-right">
                    <span
                      className={cn(
                        'inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset',
                        STATUS_STYLE[ex.status] || STATUS_STYLE.Inactive
                      )}
                    >
                      {STATUS_LABEL[ex.status] || ex.status}
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
