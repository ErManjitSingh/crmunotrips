import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { COLD_CALLING_HOME_PATH } from '../../lib/coldCallingWorkspace';

/**
 * Wraps the shared CRM layout. A Cold Calling user has no business in it, so they are sent to their
 * own workspace BEFORE the shared shell mounts (it would otherwise fire its lead/dashboard calls,
 * which this role's API fence rejects). Every other role renders the layout untouched.
 */
export default function KeepColdCallingInWorkspace({ children }) {
  const { user, getCurrentUser } = useAuth();
  const currentUser = user ?? getCurrentUser();
  if (currentUser?.role === 'cold_calling') return <Navigate to={COLD_CALLING_HOME_PATH} replace />;
  return children;
}
