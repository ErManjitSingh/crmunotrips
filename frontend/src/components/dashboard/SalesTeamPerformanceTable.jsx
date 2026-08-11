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

const HEADERS = [
  { key: 'name', label: 'Sales Executive', align: 'left' },
  { key: 'leads', label: 'Leads', align: 'right' },
  { key: 'followUps', label: 'Follow-ups', align: 'right' },
  { key: 'quotes', label: 'Quotes Sent', align: 'right' },
  { key: 'bookings', label: 'Bookings Won', align: 'right' },
  { key: 'status', label: 'Status', align: 'right' },
];

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
      <div className="overflow-x-auto rounded-xl ring-1 ring-slate-100">
        <table className="w-full min-w-[440px] border-collapse text-left text-[13px]">
          <thead>
            <tr className="bg-slate-100/90 text-[10px] font-bold uppercase tracking-[0.05em] text-slate-600">
              {HEADERS.map((h, i) => (
                <th
                  key={h.key}
                  className={cn(
                    'whitespace-nowrap py-2.5 font-bold',
                    h.align === 'right' ? 'px-2 text-right' : 'pl-3 pr-2 text-left',
                    i === 0 && 'rounded-tl-xl',
                    i === HEADERS.length - 1 && 'rounded-tr-xl pr-3'
                  )}
                >
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white">
            {executives.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400">
                  No executives found
                </td>
              </tr>
            ) : (
              executives.map((ex, idx) => (
                <tr
                  key={ex.id}
                  className={cn(
                    'border-b border-slate-100 last:border-0',
                    idx % 2 === 1 && 'bg-slate-50/50',
                    'hover:bg-violet-50/50'
                  )}
                >
                  <td className="py-2 pl-3 pr-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <Avatar name={ex.name} size="sm" className="!h-7 !w-7 !text-[10px]" />
                      <span className="truncate font-semibold text-slate-800">{ex.name}</span>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-slate-700">{ex.leads}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-slate-700">{ex.followUps}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-slate-700">{ex.quotes}</td>
                  <td className="px-2 py-2 text-right font-bold tabular-nums text-violet-700">
                    {ex.bookings}
                  </td>
                  <td className="py-2 pl-2 pr-3 text-right">
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
