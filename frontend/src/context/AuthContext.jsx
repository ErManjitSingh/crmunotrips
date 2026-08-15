import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { canAccess } from '../lib/permissions';
import { authService, AuthError } from '../auth';
import { authStorage } from '../auth/authStorage';
import store from '../store';
import { setCredentials, clearCredentials } from '../store/slices/authSlice';
import { clearBranchState, setSelectedBranch } from '../store/slices/branchSlice';
import { useRestrictedSessionTimeout } from '../hooks/useRestrictedSessionTimeout';
import { useSalesExecutiveEodLogout } from '../hooks/useSalesExecutiveEodLogout';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
    store.dispatch(clearCredentials());
    store.dispatch(clearBranchState());
  }, []);

  useRestrictedSessionTimeout(user, logout);
  useSalesExecutiveEodLogout(user, logout);

  useEffect(() => {
    const bootstrap = async () => {
      if (authStorage.isRestrictedSessionExpired()) {
        authStorage.clearSession();
        setUser(null);
        setLoading(false);
        return;
      }

      const stored = authService.getCurrentUser();
      if (stored && authStorage.getToken()) {
        try {
          const fresh = await authService.fetchCurrentUser();
          setUser(fresh);
          if (fresh?.branchId && fresh?.role !== 'admin') {
            store.dispatch(setSelectedBranch(fresh.branchId));
          }
        } catch {
          authStorage.clearSession();
          setUser(null);
        }
      } else {
        setUser(stored);
      }
      setLoading(false);
    };
    bootstrap();
  }, []);

  const login = useCallback(async (email, password) => {
    const sessionUser = await authService.login(email, password);
    setUser(sessionUser);
    store.dispatch(setCredentials({ user: sessionUser, token: authStorage.getToken() }));
    if (sessionUser?.branchId && sessionUser?.role !== 'admin') {
      store.dispatch(setSelectedBranch(sessionUser.branchId));
    }
    return sessionUser;
  }, []);

  const getCurrentUser = useCallback(() => {
    const current = authService.getCurrentUser();
    if (current && !user) setUser(current);
    return current ?? user;
  }, [user]);

  const hasPermission = useCallback(
    (module, action = 'view') => canAccess(user, module, action),
    [user]
  );

  const getDashboardPath = useCallback(
    (role = user?.role) => authService.getDashboardPath(role),
    [user]
  );

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      getCurrentUser,
      hasPermission,
      getDashboardPath,
      AuthError,
    }),
    [user, loading, login, logout, getCurrentUser, hasPermission, getDashboardPath]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
