import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { VALID_ROLES } from '../../auth';

function AuthLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-app">
      <div className="flex flex-col items-center gap-3">
        <div className="w-9 h-9 border-2 border-[#5D5FEF] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-content-muted">Loading session…</p>
      </div>
    </div>
  );
}

/** Protects HR portal routes — hr_admin only, redirects to /hr/login. */
export default function HrProtectedRoute({ children }) {
  const { user, loading, getCurrentUser } = useAuth();
  const location = useLocation();

  if (loading) return <AuthLoading />;

  const currentUser = user ?? getCurrentUser();

  if (!currentUser) {
    return <Navigate to="/hr/login" replace state={{ from: location.pathname }} />;
  }

  if (!VALID_ROLES.includes(currentUser.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (currentUser.role !== 'hr_admin') {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
