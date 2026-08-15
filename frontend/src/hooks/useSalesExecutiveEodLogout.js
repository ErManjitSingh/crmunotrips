import { useEffect, useRef } from 'react';
import API from '../api/axios';
import { authStorage } from '../auth/authStorage';
import {
  getTodayEodCutoffMs,
  requiresEodLogout,
  shouldForceEodLogout,
} from '../auth/sessionPolicy';
import { toast } from '../context/ToastContext';

const CHECK_INTERVAL_MS = 30 * 1000;

/**
 * At 6:20 PM IST, sales executive panels auto-logout.
 * Re-login after that is allowed; attendance check-in records the new login time.
 */
export function useSalesExecutiveEodLogout(user, logout) {
  const loggingOutRef = useRef(false);

  useEffect(() => {
    if (!user || !requiresEodLogout(user.role)) return undefined;

    const forceLogout = async () => {
      if (loggingOutRef.current) return;
      loggingOutRef.current = true;
      try {
        await API.post('/attendance/check-out', null, {
          skipSuccessToast: true,
          skipErrorToast: true,
        });
      } catch {
        /* already checked out or no open session */
      }
      try {
        await logout();
      } catch {
        authStorage.clearSession();
      }
      toast.info('Work day ended at 6:20 PM. Please sign in again.');
      if (window.location.pathname !== '/login') {
        window.location.replace('/login');
      }
    };

    const check = () => {
      if (shouldForceEodLogout(authStorage.getToken())) {
        forceLogout();
      }
    };

    check();
    const intervalId = window.setInterval(check, CHECK_INTERVAL_MS);

    const cutoff = getTodayEodCutoffMs();
    const delay = cutoff - Date.now();
    let timeoutId;
    if (delay > 0) {
      timeoutId = window.setTimeout(forceLogout, delay + 250);
    }

    return () => {
      window.clearInterval(intervalId);
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [user, logout]);
}
