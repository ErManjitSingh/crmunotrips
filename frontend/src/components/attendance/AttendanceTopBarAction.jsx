import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import API from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { requiresAttendanceCheckIn } from '../../constants/attendance';
import { useDataRefresh } from '../../hooks/useDataRefresh';
import { cn } from '../../lib/utils';

export default function AttendanceTopBarAction({ accent }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [acting, setActing] = useState(false);

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
    if (acting) return;
    setActing(true);
    try {
      await API.post('/attendance/check-out', {}, { successMessage: 'Checked out successfully' });
      try {
        await logout();
      } finally {
        navigate('/login', { replace: true });
      }
    } catch {
      setActing(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCheckOut}
      disabled={acting}
      className={cn(
        'hidden sm:inline-flex items-center gap-2 h-10 px-3 rounded-xl border border-subtle',
        'bg-surface/90 text-sm font-medium text-content-secondary shadow-sm',
        'hover:bg-surface-elevated transition-colors disabled:opacity-60',
        accent?.iconHover
      )}
      title="Check out and end session"
    >
      <LogOut className="w-4 h-4" />
      {acting ? 'Checking out…' : 'Check Out'}
    </button>
  );
}
