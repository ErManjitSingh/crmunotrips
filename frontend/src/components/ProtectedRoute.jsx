import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { VALID_ROLES } from '../auth';
import AttendanceLoginGate from './attendance/AttendanceLoginGate';

function AuthLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-app">
      <div className="flex flex-col items-center gap-3">
        <div className="w-9 h-9 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-content-muted">Loading session…</p>
      </div>
    </div>
  );
}

/**
 * Protects routes requiring authentication.
 * Optional allowedRoles restricts access to specific role slugs.
 */
export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading, getCurrentUser } = useAuth();
  const location = useLocation();

  if (loading) return <AuthLoading />;

  const currentUser = user ?? getCurrentUser();

  if (!currentUser) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!VALID_ROLES.includes(currentUser.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (allowedRoles?.length && !allowedRoles.includes(currentUser.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (currentUser.role === 'hr_admin' && !location.pathname.startsWith('/hr')) {
    return <Navigate to="/hr/dashboard" replace />;
  }

  return (
    <>
      <AttendanceLoginGate />
      {children}
    </>
  );
}
