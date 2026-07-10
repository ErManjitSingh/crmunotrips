import { useCallback, useEffect, useState } from 'react';
import { LogOut } from 'lucide-react';
import API from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { requiresAttendanceCheckIn } from '../../constants/attendance';
import { useDataRefresh } from '../../hooks/useDataRefresh';
import { cn } from '../../lib/utils';

export default function AttendanceTopBarAction({ accent }) {
  const { user } = useAuth();
  const [status, setStatus] = useState(null);

  const load = useCallback(() => {
    if (!requiresAttendanceCheckIn(user?.role)) return;
    API.get('/attendance/status', { skipSuccessToast: true })
      .then((r) => setStatus(r.data))
      .catch(() => setStatus(null));
  }, [user?.role]);

  useEffect(() => {
    load();
  }, [load]);

  useDataRefresh(['attendance'], load);

  if (!requiresAttendanceCheckIn(user?.role) || !status?.canCheckOut) {
    return null;
  }

  const handleCheckOut = async () => {
    await API.post('/attendance/check-out', {}, { successMessage: 'Checked out successfully' });
    load();
  };

  return (
    <button
      type="button"
      onClick={handleCheckOut}
      className={cn(
        'hidden sm:inline-flex items-center gap-2 h-10 px-3 rounded-xl border border-subtle',
        'bg-surface/90 text-sm font-medium text-content-secondary shadow-sm',
        'hover:bg-surface-elevated transition-colors',
        accent?.iconHover
      )}
      title="Check out for today"
    >
      <LogOut className="w-4 h-4" />
      Check Out
    </button>
  );
}
