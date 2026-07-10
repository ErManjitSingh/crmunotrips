import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import API from '../api/axios';
import { useDataRefresh } from '../hooks/useDataRefresh';
import PageHeader from '../components/ui/PageHeader';
import {
  AttendanceStatsCards,
  AttendanceTeamList,
  AttendanceFilterBar,
} from '../components/attendance';
import {
  getRangeForPreset,
  formatRangeLabel,
  isSingleDayRange,
} from '../components/attendance/attendanceDateUtils';

function AbsentList({ users = [], title = 'Absent Today' }) {
  if (!users.length) {
    return (
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5 text-sm text-emerald-700 dark:text-emerald-400 text-center">
        Everyone has checked in
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-subtle bg-surface/80 overflow-hidden">
      <div className="px-5 py-3 border-b border-subtle bg-rose-500/[0.04]">
        <h3 className="font-semibold text-content-primary">{title} ({users.length})</h3>
      </div>
      <ul className="divide-y divide-subtle/60 max-h-64 overflow-y-auto">
        {users.map((u) => (
          <li key={u.userId} className="px-5 py-3 flex items-center justify-between gap-2">
            <div>
              <p className="font-medium text-content-primary text-sm">{u.userName}</p>
              <p className="text-xs text-content-muted">{u.userEmail}</p>
            </div>
            <span className="text-[10px] font-semibold uppercase text-rose-600 dark:text-rose-400">Absent</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function AdminAttendancePage() {
  const initialRange = getRangeForPreset('today');
  const [preset, setPreset] = useState('today');
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const isSingleDay = isSingleDayRange(from, to);
  const isRange = !isSingleDay;
  const rangeLabel = formatRangeLabel(from, to, preset);

  const load = useCallback(() => {
    setLoading(true);
    API.get('/attendance/summary', {
      params: { from, to },
      skipSuccessToast: true,
    })
      .then((r) => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  useDataRefresh(['attendance'], load);

  const handlePreset = (id) => {
    const range = getRangeForPreset(id);
    setPreset(id);
    setFrom(range.from);
    setTo(range.to);
  };

  const handleCustomFrom = (value) => {
    if (!value) return;
    setPreset('custom');
    setFrom(value);
    if (to && value > to) setTo(value);
  };

  const handleCustomTo = (value) => {
    if (!value) return;
    setPreset('custom');
    setTo(value);
    if (from && value < from) setFrom(value);
  };

  const sectionTitles = useMemo(() => {
    return {
      office: isSingleDay ? 'Office Today' : 'Office',
      online: 'Currently Online',
      late: isSingleDay ? 'Late Today' : 'Late',
      all: isSingleDay ? 'All Attendance Today' : `All Check-ins (${rangeLabel})`,
      absent: isSingleDay ? 'Absent Today' : 'Absent',
    };
  }, [isSingleDay, rangeLabel]);

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Attendance"
        description="Filter by today, yesterday, last 7 days, or the full month — office, late & online"
        breadcrumbs={['Team Management', 'Attendance']}
      />

      <AttendanceFilterBar
        preset={preset}
        onPresetChange={handlePreset}
        customFrom={from}
        customTo={to}
        onCustomFromChange={handleCustomFrom}
        onCustomToChange={handleCustomTo}
        rangeLabel={rangeLabel}
      />

      {!loading && data && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-2 rounded-xl border border-brand-500/15 bg-brand-500/[0.04] px-4 py-2.5 text-xs text-content-secondary"
        >
          <Sparkles className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400 shrink-0" />
          {isRange
            ? `Showing ${data.summary?.totalCheckIns ?? 0} check-ins across ${data.summary?.dayCount ?? 0} days · ${data.summary?.uniqueUsers ?? 0} team members`
            : `Live view for ${rangeLabel} · Asia/Kolkata`}
        </motion.div>
      )}

      {loading ? (
        <div className="space-y-4">
          <div className="h-28 rounded-2xl border border-subtle bg-surface/50 animate-pulse" />
          <div className="h-64 rounded-2xl border border-subtle bg-surface/50 animate-pulse" />
        </div>
      ) : (
        <>
          <AttendanceStatsCards summary={data?.summary} isRange={isRange} />

          {isSingleDay ? (
            <>
              <AttendanceTeamList
                records={data?.officeUsers}
                title={sectionTitles.office}
                emptyMessage="No office check-ins"
              />

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <AttendanceTeamList
                  records={data?.onlineUsers}
                  title={sectionTitles.online}
                  emptyMessage="No one is currently checked in"
                />
                <AttendanceTeamList
                  records={data?.lateUsers}
                  title={sectionTitles.late}
                  emptyMessage="No late check-ins"
                />
              </div>

              <AbsentList users={data?.absentUsers} title={sectionTitles.absent} />
            </>
          ) : null}

          <AttendanceTeamList
            records={data?.teamAttendance}
            title={sectionTitles.all}
            emptyMessage={isRange ? 'No check-ins in this period' : 'No check-ins yet'}
            showDate={isRange}
          />
        </>
      )}
    </div>
  );
}
