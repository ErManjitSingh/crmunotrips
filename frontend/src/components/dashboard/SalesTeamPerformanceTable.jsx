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
      noPadding
      action={
        <Link
          to="/team"
          className="mr-5 mt-5 text-xs font-semibold text-violet-600 hover:underline"
        >
          View All
        </Link>
      }
    >
      <div className="overflow-x-auto px-5 pb-4 pt-3">
        <table className="w-full min-w-[420px] text-left text-[13px]">
          <thead>
            <tr className="border-b border-slate-100 text-[10px] uppercase tracking-wide text-slate-400">
              <th className="pb-2 pr-2 font-semibold">Executive</th>
              <th className="pb-2 px-1 font-semibold text-right">Leads</th>
              <th className="pb-2 px-1 font-semibold text-right">Follow-ups</th>
              <th className="pb-2 px-1 font-semibold text-right">Quotes</th>
              <th className="pb-2 px-1 font-semibold text-right">Bookings</th>
              <th className="pb-2 pl-1 font-semibold text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {executives.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-6 text-center text-slate-400">
                  No executives found
                </td>
              </tr>
            ) : (
              executives.map((ex, i) => (
                <tr
                  key={ex.id}
                  className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70"
                >
                  <td className="py-1.5 pr-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="w-3.5 shrink-0 text-[10px] font-bold tabular-nums text-slate-300">
                        {i + 1}
                      </span>
                      <Avatar name={ex.name} size="sm" className="!h-7 !w-7 !text-[10px]" />
                      <span className="truncate font-medium text-slate-800">{ex.name}</span>
                    </div>
                  </td>
                  <td className="py-1.5 px-1 text-right tabular-nums text-slate-700">{ex.leads}</td>
                  <td className="py-1.5 px-1 text-right tabular-nums text-slate-700">
                    {ex.followUps}
                  </td>
                  <td className="py-1.5 px-1 text-right tabular-nums text-slate-700">{ex.quotes}</td>
                  <td className="py-1.5 px-1 text-right font-semibold tabular-nums text-violet-700">
                    {ex.bookings}
                  </td>
                  <td className="py-1.5 pl-1 text-right">
                    <span
                      className={cn(
                        'inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset',
                        STATUS_STYLE[ex.status] || STATUS_STYLE.Inactive
                      )}
                    >
                      {ex.status === 'Needs Attention' ? 'Focus' : ex.status}
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
