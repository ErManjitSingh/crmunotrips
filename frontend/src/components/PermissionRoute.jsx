import { Navigate } from 'react-router-dom';
import { usePermissions } from '../hooks/usePermissions';
import { useAuth } from '../context/AuthContext';

export default function PermissionRoute({
  module,
  action = 'view',
  children,
  redirectTo,
  roles,
  denyRoles,
}) {
  const { user, can } = usePermissions();
  const { getDashboardPath } = useAuth();

  if (!user) return <Navigate to="/login" replace />;

  const fallback = redirectTo ?? user.dashboardPath ?? getDashboardPath(user.role) ?? '/';

  if (denyRoles?.length && denyRoles.includes(user.role)) {
    return <Navigate to={fallback} replace />;
  }

  if (roles?.length && !roles.includes(user.role)) {
    return <Navigate to={fallback} replace />;
  }

  if (module && !can(module, action)) {
    return <Navigate to={fallback} replace />;
  }

  return children;
}
