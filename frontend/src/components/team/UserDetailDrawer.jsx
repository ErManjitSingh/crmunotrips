import { X, Mail, Phone, Building2, Shield, Calendar, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Avatar from '../ui/Avatar';
import UserStatusBadge from './UserStatusBadge';
import UserStatusToggle from './UserStatusToggle';
import { Button } from '../ui/button';
import AppDrawer from '../ui/AppDrawer';
import { formatLastLogin } from './constants';

export default function UserDetailDrawer({
  user,
  open,
  onClose,
  onEdit,
  onToggleStatus,
  currentUserId,
  togglingUserId,
}) {
  const navigate = useNavigate();

  return (
    <AppDrawer open={open && !!user} onClose={onClose}>
      {user && (
        <>
          <div className="flex items-center justify-between px-6 py-4 border-b border-subtle shrink-0">
            <h2 className="text-lg font-bold text-content-primary">User Details</h2>
            <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-surface-elevated text-content-muted"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="flex flex-col items-center text-center pb-6 border-b border-subtle">
              <Avatar name={user.name} size="lg" className="!w-20 !h-20 !text-2xl ring-4 ring-brand-500/10 mb-3" />
              <h3 className="text-xl font-bold text-content-primary">{user.name}</h3>
              <p className="text-sm text-content-secondary mt-0.5">{user.email}</p>
              <div className="mt-3 flex flex-col items-center gap-2">
                {onToggleStatus && (user.status === 'active' || user.status === 'disabled') ? (
                  <div className="flex items-center gap-3">
                    <UserStatusToggle
                      active={user.status === 'active'}
                      disabled={String(user._id) === String(currentUserId)}
                      loading={togglingUserId === user._id}
                      onChange={() => onToggleStatus(user)}
                    />
                    <span className="text-sm font-medium text-content-secondary">
                      {user.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                ) : (
                  <UserStatusBadge status={user.status} />
                )}
              </div>
            </div>
            <div className="space-y-3">
              {[
                { icon: Shield, label: 'Role', value: user.roleName },
                { icon: Building2, label: 'Department', value: user.department },
                { icon: Phone, label: 'Phone', value: user.phone || '—' },
                { icon: Mail, label: 'Email', value: user.email },
                { icon: Calendar, label: 'Last Login', value: formatLastLogin(user.lastLogin) },
                { icon: Users, label: 'Assigned Leads', value: user.assignedLeads ?? 0 },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-3 p-3 rounded-xl bg-surface-elevated/50 border border-subtle">
                  <div className="p-2 rounded-lg bg-brand-500/10"><Icon className="w-4 h-4 text-brand-600" /></div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wider text-content-muted">{label}</p>
                    <p className="text-sm font-medium text-content-primary">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="p-6 border-t border-subtle flex gap-3 shrink-0">
            <Button variant="outline" className="flex-1" onClick={() => { onClose(); onEdit?.(user); }}>Edit User</Button>
            <Button className="flex-1" onClick={() => { onClose(); navigate(`/team/users/${user._id}`); }}>Full Profile</Button>
          </div>
        </>
      )}
    </AppDrawer>
  );
}
