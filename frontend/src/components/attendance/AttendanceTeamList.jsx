import { cn } from '../../lib/utils';

function formatTime(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso));
}

function formatLateBy(mins) {
  if (mins == null || mins <= 0) return '—';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

const STATUS_PILL = {
  present: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  late: 'bg-orange-50 text-orange-700 ring-orange-200',
  absent: 'bg-rose-50 text-rose-700 ring-rose-200',
  on_leave: 'bg-sky-50 text-sky-700 ring-sky-200',
};

const STATUS_LABEL = {
  present: 'Present',
  late: 'Late',
  absent: 'Absent',
  on_leave: 'On Leave',
};

function StatusPill({ status }) {
  const key = status === 'on leave' ? 'on_leave' : status;
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
        STATUS_PILL[key] || 'bg-slate-100 text-slate-600 ring-slate-200'
      )}
    >
      {STATUS_LABEL[key] || status}
    </span>
  );
}

export function OfficeTodayTable({
  records = [],
  title = 'Office Today',
  emptyMessage = 'No attendance records',
  onView,
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-3.5">
        <h3 className="text-base font-bold text-slate-900">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-5 py-3">Employee</th>
              <th className="px-4 py-3">Check In</th>
              <th className="px-4 py-3">Check Out</th>
              <th className="px-4 py-3">Hours</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-5 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {!records.length ? (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-slate-400">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              records.map((r) => (
                <tr
                  key={r.id || r.userId}
                  className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70"
                >
                  <td className="px-5 py-3.5 font-semibold text-slate-800">{r.userName}</td>
                  <td className="px-4 py-3.5 tabular-nums text-slate-600">
                    <div>{formatTime(r.checkIn)}</div>
                    {r.firstCheckIn &&
                      r.checkIn &&
                      new Date(r.firstCheckIn).getTime() !== new Date(r.checkIn).getTime() && (
                        <div className="mt-0.5 text-[10px] font-medium text-slate-400">
                          First {formatTime(r.firstCheckIn)}
                        </div>
                      )}
                  </td>
                  <td className="px-4 py-3.5 tabular-nums text-slate-600">{formatTime(r.checkOut)}</td>
                  <td className="px-4 py-3.5 tabular-nums text-slate-600">
                    {r.hoursLabel || (r.totalHours != null ? `${r.totalHours}h` : '—')}
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusPill status={r.status} />
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      type="button"
                      onClick={() => onView?.(r)}
                      className="text-sm font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function CurrentlyOnlineTable({
  records = [],
  emptyMessage = 'No one is currently online',
  onViewAll,
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        <h3 className="text-base font-bold text-slate-900">Currently Online</h3>
      </div>
      <div className="flex-1 overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-5 py-2.5">Employee</th>
              <th className="px-3 py-2.5">Check In</th>
              <th className="px-3 py-2.5">Duration</th>
              <th className="px-5 py-2.5">Department</th>
            </tr>
          </thead>
          <tbody>
            {!records.length ? (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-slate-400">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              records.slice(0, 6).map((r) => (
                <tr key={r.id || r.userId} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-3 font-medium text-slate-800">{r.userName}</td>
                  <td className="px-3 py-3 tabular-nums text-slate-600">{formatTime(r.checkIn)}</td>
                  <td className="px-3 py-3 tabular-nums text-slate-600">
                    {r.hoursLabel || '—'}
                  </td>
                  <td className="px-5 py-3 text-slate-600">{r.department || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={onViewAll}
        className="border-t border-slate-100 px-5 py-3 text-left text-sm font-semibold text-blue-600 hover:bg-blue-50/50"
      >
        View All Online Employees →
      </button>
    </div>
  );
}

export function LateTodayTable({
  records = [],
  emptyMessage = 'No late check-ins',
  onViewAll,
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5">
        <span className="h-2 w-2 rounded-full bg-orange-500" />
        <h3 className="text-base font-bold text-slate-900">Late Today</h3>
      </div>
      <div className="flex-1 overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-5 py-2.5">Employee</th>
              <th className="px-3 py-2.5">Check In</th>
              <th className="px-3 py-2.5">Expected Time</th>
              <th className="px-5 py-2.5">Late By</th>
            </tr>
          </thead>
          <tbody>
            {!records.length ? (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-slate-400">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              records.slice(0, 6).map((r) => (
                <tr key={r.id || r.userId} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-3 font-medium text-slate-800">{r.userName}</td>
                  <td className="px-3 py-3 tabular-nums text-slate-600">
                    {formatTime(r.firstCheckIn || r.checkIn)}
                  </td>
                  <td className="px-5 py-3 font-semibold tabular-nums text-orange-600">
                    {formatLateBy(r.lateByMinutes)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={onViewAll}
        className="border-t border-slate-100 px-5 py-3 text-left text-sm font-semibold text-blue-600 hover:bg-blue-50/50"
      >
        View All Late Employees →
      </button>
    </div>
  );
}

export default function AttendanceTeamList(props) {
  return <OfficeTodayTable {...props} title={props.title || 'Team Attendance'} />;
}
