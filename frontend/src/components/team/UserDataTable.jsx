import { useNavigate } from 'react-router-dom';
import { Eye, Pencil, KeyRound, UserCheck, UserX, Trash2, MoreHorizontal, Target } from 'lucide-react';
import Avatar from '../ui/Avatar';
import UserStatusBadge from './UserStatusBadge';
import UserStatusToggle from './UserStatusToggle';
import { formatLastLogin } from './constants';
import { compactTable, compactTh, compactTd } from '../ui/compactTable';
import {
  DropdownMenuRoot,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

const TARGETABLE_ROLES = new Set(['sales_executive', 'team_leader']);

export default function UserDataTable({
  users,
  onEdit,
  onResetPassword,
  onDisable,
  onToggleStatus,
  onDelete,
  onView,
  onSetTarget,
  permissions = {},
  currentUserId,
  currentUserRole,
  togglingUserId,
}) {
  const navigate = useNavigate();
  const hasActions = onEdit || onResetPassword || onDisable || onDelete || onView || onSetTarget;

  const showSetTarget = (user) => {
    if (!onSetTarget || !TARGETABLE_ROLES.has(user.role)) return false;
    if (currentUserRole === 'team_leader') return user.role === 'sales_executive';
    return true;
  };

  if (!users.length) {
    return (
      <div className="rounded-2xl border border-subtle bg-surface/80 backdrop-blur-xl p-12 text-center text-content-muted">
        No users match your filters
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-subtle bg-surface/80 backdrop-blur-xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className={compactTable}>
          <thead>
            <tr className="border-b border-subtle bg-surface-elevated/50">
              {['Profile', 'Name', 'Email', 'Phone', 'Role', 'Department', 'Status', 'Last Login', 'Assigned Leads', 'Actions'].map((h) => (
                <th key={h} className={compactTh}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-subtle">
            {users.map((user) => (
              <tr key={user._id} className="group hover:bg-brand-500/[0.03] transition-colors">
                <td className={compactTd}>
                  <Avatar name={user.name} size="sm" className="!w-7 !h-7 ring-1 ring-brand-500/10" />
                </td>
                <td className={compactTd}>
                  <button
                    type="button"
                    onClick={() => navigate(`/team/users/${user._id}`)}
                    className="text-sm font-semibold text-content-primary hover:text-brand-600 transition-colors whitespace-nowrap"
                  >
                    {user.name}
                  </button>
                </td>
                <td className={`${compactTd} text-content-secondary max-w-[160px] truncate`}>{user.email}</td>
                <td className={`${compactTd} text-content-secondary`}>{user.phone || '—'}</td>
                <td className={compactTd}>
                  <span className="inline-flex px-1.5 py-0.5 rounded-md text-[11px] font-medium bg-violet-500/10 text-violet-600 dark:text-violet-400 ring-1 ring-violet-500/20 whitespace-nowrap">
                    {user.roleName}
                  </span>
                </td>
                <td className={`${compactTd} text-content-secondary`}>{user.department}</td>
                <td className={compactTd}>
                  <div className="flex items-center gap-2">
                    {onToggleStatus && (user.status === 'active' || user.status === 'disabled') ? (
                      <>
                        <UserStatusToggle
                          active={user.status === 'active'}
                          disabled={String(user._id) === String(currentUserId)}
                          loading={togglingUserId === user._id}
                          onChange={() => onToggleStatus(user)}
                          size="sm"
                        />
                        <span className="text-[11px] font-medium text-content-secondary whitespace-nowrap">
                          {user.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </>
                    ) : (
                      <UserStatusBadge status={user.status} />
                    )}
                  </div>
                </td>
                <td className={`${compactTd} text-content-muted text-xs`}>{formatLastLogin(user.lastLogin)}</td>
                <td className={compactTd}>
                  <span className="text-sm font-semibold text-content-primary tabular-nums">{user.assignedLeads ?? 0}</span>
                </td>
                <td className={compactTd} onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1.5">
                    {showSetTarget(user) && (
                      <button
                        type="button"
                        onClick={() => onSetTarget(user)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100"
                      >
                        <Target className="w-3 h-3" />
                        Set Target
                      </button>
                    )}
                  {hasActions ? (
                  <DropdownMenuRoot>
                    <DropdownMenuTrigger asChild>
                      <button className="p-2 rounded-xl hover:bg-surface-elevated text-content-muted opacity-60 group-hover:opacity-100 transition-all">
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => (onView ? onView(user) : navigate(`/team/users/${user._id}`))}>
                        <Eye className="w-4 h-4 mr-2 text-sky-600" /> View User
                      </DropdownMenuItem>
                      {onEdit && (
                        <DropdownMenuItem onClick={() => onEdit(user)}>
                          <Pencil className="w-4 h-4 mr-2 text-violet-600" /> Edit User
                        </DropdownMenuItem>
                      )}
                      {showSetTarget(user) && (
                        <DropdownMenuItem onClick={() => onSetTarget(user)}>
                          <Target className="w-4 h-4 mr-2 text-sky-600" /> Set Target
                        </DropdownMenuItem>
                      )}
                      {onResetPassword && (
                        <DropdownMenuItem onClick={() => onResetPassword(user)}>
                          <KeyRound className="w-4 h-4 mr-2 text-amber-600" /> Reset Password
                        </DropdownMenuItem>
                      )}
                      {onToggleStatus && user.status === 'active' && String(user._id) !== String(currentUserId) && (
                        <DropdownMenuItem onClick={() => onToggleStatus(user)}>
                          <UserX className="w-4 h-4 mr-2 text-orange-600" /> Deactivate User
                        </DropdownMenuItem>
                      )}
                      {onToggleStatus && user.status === 'disabled' && (
                        <DropdownMenuItem onClick={() => onToggleStatus(user)}>
                          <UserCheck className="w-4 h-4 mr-2 text-emerald-600" /> Activate User
                        </DropdownMenuItem>
                      )}
                      {onDisable && user.status === 'active' && !onToggleStatus && (
                        <DropdownMenuItem onClick={() => onDisable(user)}>
                          <UserX className="w-4 h-4 mr-2 text-orange-600" /> Disable User
                        </DropdownMenuItem>
                      )}
                      {onDelete && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => onDelete(user)} className="text-rose-600 focus:text-rose-600">
                            <Trash2 className="w-4 h-4 mr-2" /> Delete User
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenuRoot>
                  ) : !showSetTarget(user) ? (
                    <button type="button" onClick={() => navigate(`/team/users/${user._id}`)} className="p-2 rounded-xl hover:bg-surface-elevated text-content-muted">
                      <Eye className="w-4 h-4" />
                    </button>
                  ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
