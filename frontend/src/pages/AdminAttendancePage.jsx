import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileText, CalendarDays, Plus } from 'lucide-react';
import API from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useDataRefresh } from '../hooks/useDataRefresh';
import { toast } from '../context/ToastContext';
import { requiresAttendanceCheckIn } from '../constants/attendance';
import {
  AttendanceStatsCards,
  AttendanceFilterBar,
} from '../components/attendance';
import {
  OfficeTodayTable,
  CurrentlyOnlineTable,
  LateTodayTable,
} from '../components/attendance/AttendanceTeamList';
import {
  getRangeForPreset,
  formatRangeLabel,
  isSingleDayRange,
} from '../components/attendance/attendanceDateUtils';

function matchesSearch(row, q) {
  if (!q) return true;
  const hay = `${row.userName || ''} ${row.department || ''} ${row.userRole || ''} ${row.userEmail || ''}`.toLowerCase();
  return hay.includes(q);
}

export default function AdminAttendancePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const initialRange = getRangeForPreset('today');
  const [preset, setPreset] = useState('today');
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState('');
  const [marking, setMarking] = useState(false);
  const [focusList, setFocusList] = useState('office');

  const isSingleDay = isSingleDayRange(from, to);
  const rangeLabel = formatRangeLabel(from, to, preset);
  const q = search.trim().toLowerCase();

  const load = useCallback(() => {
    setLoading(true);
    API.get('/attendance/summary', {
      params: {
        from,
        to,
        ...(branchId ? { branchId } : {}),
      },
      skipSuccessToast: true,
    })
      .then((r) => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [from, to, branchId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    API.get('/branches', { skipSuccessToast: true, skipErrorToast: true })
      .then((r) => setBranches(Array.isArray(r.data) ? r.data : r.data?.data || []))
      .catch(() => setBranches([]));
  }, []);

  useDataRefresh(['attendance'], load);

  const handlePreset = (id) => {
    const range = getRangeForPreset(id);
    setPreset(id);
    setFrom(range.from);
    setTo(range.to);
    setFocusList('office');
  };

  const handleCustomFrom = (value) => {
    if (!value) return;
    setPreset('custom');
    setFrom(value);
    setTo(value);
  };

  const officeRows = useMemo(() => {
    const rows = data?.officeRows?.length
      ? data.officeRows
      : [...(data?.officeUsers || []), ...(data?.absentUsers || [])];
    return rows.filter((r) => matchesSearch(r, q));
  }, [data, q]);

  const onlineRows = useMemo(
    () => (data?.onlineUsers || []).filter((r) => matchesSearch(r, q)),
    [data, q]
  );

  const lateRows = useMemo(
    () => (data?.lateUsers || []).filter((r) => matchesSearch(r, q)),
    [data, q]
  );

  const handleMarkAttendance = async () => {
    if (!requiresAttendanceCheckIn(user?.role)) {
      toast.info('Team members mark attendance from their login / dashboard check-in.');
      return;
    }
    setMarking(true);
    try {
      const { data: status } = await API.get('/attendance/status', { skipSuccessToast: true });
      if (status?.canCheckOut) {
        await API.post('/attendance/check-out', {}, { successMessage: 'Checked out successfully' });
      } else if (status?.canCheckIn) {
        await API.post(
          '/attendance/check-in',
          { workMode: 'office' },
          { successMessage: 'Attendance marked — checked in' }
        );
      } else {
        toast.info('Attendance already recorded for today');
      }
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not mark attendance');
    } finally {
      setMarking(false);
    }
  };

  const officeTitle = isSingleDay
    ? data?.isToday || preset === 'today'
      ? 'Office Today'
      : `Office · ${rangeLabel}`
    : `Attendance · ${rangeLabel}`;

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[28px]">
            Attendance
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Track employee attendance and working hours in real-time
          </p>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:items-end">
          <button
            type="button"
            disabled={marking}
            onClick={handleMarkAttendance}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-md shadow-blue-600/25 transition hover:bg-blue-700 disabled:opacity-60"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            Mark Attendance
          </button>
          <div className="flex flex-wrap items-center justify-end gap-4 text-sm font-medium text-slate-600">
            <Link
              to="/reports"
              className="inline-flex items-center gap-1.5 hover:text-blue-600"
            >
              <FileText className="h-4 w-4" />
              Attendance Report
            </Link>
            <button
              type="button"
              onClick={() => handlePreset('today')}
              className="inline-flex items-center gap-1.5 hover:text-blue-600"
            >
              <CalendarDays className="h-4 w-4" />
              Calendar View
            </button>
          </div>
        </div>
      </div>

      <AttendanceFilterBar
        preset={preset}
        onPresetChange={handlePreset}
        customFrom={from}
        onCustomFromChange={handleCustomFrom}
        rangeLabel={rangeLabel}
        search={search}
        onSearchChange={setSearch}
        branches={branches}
        branchId={branchId}
        onBranchChange={setBranchId}
      />

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-[76px] animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
          <div className="h-72 animate-pulse rounded-2xl bg-slate-100" />
        </div>
      ) : (
        <>
          <AttendanceStatsCards summary={data?.summary} />

          {isSingleDay ? (
            <>
              <OfficeTodayTable
                records={
                  focusList === 'online'
                    ? onlineRows
                    : focusList === 'late'
                      ? lateRows
                      : officeRows
                }
                title={
                  focusList === 'online'
                    ? 'Currently Online'
                    : focusList === 'late'
                      ? 'Late Today'
                      : officeTitle
                }
                emptyMessage={
                  focusList === 'online'
                    ? 'No one is currently checked in'
                    : focusList === 'late'
                      ? 'No late check-ins'
                      : 'No attendance records'
                }
                onView={(row) => {
                  if (row?.userId) navigate(`/team/users/${row.userId}`);
                }}
              />

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <CurrentlyOnlineTable
                  records={onlineRows}
                  onViewAll={() => setFocusList('online')}
                />
                <LateTodayTable
                  records={lateRows}
                  onViewAll={() => setFocusList('late')}
                />
              </div>
            </>
          ) : (
            <OfficeTodayTable
              records={(data?.teamAttendance || []).filter((r) => matchesSearch(r, q))}
              title={officeTitle}
              emptyMessage="No check-ins in this period"
            />
          )}
        </>
      )}
    </div>
  );
}
