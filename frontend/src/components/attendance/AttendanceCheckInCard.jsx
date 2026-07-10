import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, LogIn, LogOut, Clock } from 'lucide-react';
import API from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { requiresAttendanceCheckIn } from '../../constants/attendance';
import { useDataRefresh } from '../../hooks/useDataRefresh';

function formatTime(iso) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso));
}

export default function AttendanceCheckInCard({ onChanged }) {
  const { user } = useAuth();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    API.get('/attendance/status', { skipSuccessToast: true })
      .then((r) => setStatus(r.data))
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useDataRefresh(['attendance'], () => {
    load();
    onChanged?.();
  });

  const handleCheckIn = async () => {
    setActing(true);
    try {
      await API.post(
        '/attendance/check-in',
        { workMode: 'office' },
        { successMessage: 'Office check-in completed' }
      );
      load();
      onChanged?.();
    } finally {
      setActing(false);
    }
  };

  const handleCheckOut = async () => {
    setActing(true);
    try {
      await API.post('/attendance/check-out', {}, { successMessage: 'Checked out successfully' });
      load();
      onChanged?.();
    } finally {
      setActing(false);
    }
  };

  if (!requiresAttendanceCheckIn(user?.role)) {
    return null;
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-subtle bg-surface/80 p-5 animate-pulse h-[140px]" />
    );
  }

  const record = status?.record;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-subtle bg-surface/80 backdrop-blur-xl p-5"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-content-muted mb-1">
            <Clock className="w-3.5 h-3.5" /> Attendance
          </div>
          {status?.checkedIn ? (
            <>
              <p className="text-lg font-bold text-content-primary">
                Checked in · Office
                {record?.status === 'late' && (
                  <span className="ml-2 text-xs font-semibold text-amber-600 dark:text-amber-400">Late</span>
                )}
              </p>
              <p className="text-sm text-content-secondary mt-0.5">
                In: {formatTime(record?.checkIn)}
                {status.checkedOut && ` · Out: ${formatTime(record?.checkOut)}`}
                {record?.totalHours != null && ` · ${record.totalHours}h`}
              </p>
            </>
          ) : (
            <>
              <p className="text-lg font-bold text-content-primary">Not checked in today</p>
              <p className="text-sm text-content-secondary mt-0.5">Mark your office attendance for today</p>
            </>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {status?.canCheckOut && (
            <button
              type="button"
              onClick={handleCheckOut}
              disabled={acting}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold disabled:opacity-60"
            >
              <LogOut className="w-4 h-4" /> Check Out
            </button>
          )}
          {status?.canCheckIn && (
            <button
              type="button"
              onClick={handleCheckIn}
              disabled={acting}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold disabled:opacity-60"
            >
              <Building2 className="w-4 h-4" />
              <LogIn className="w-4 h-4" /> Check In
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
