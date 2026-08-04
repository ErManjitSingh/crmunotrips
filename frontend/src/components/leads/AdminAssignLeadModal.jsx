import { useEffect, useMemo, useState } from 'react';
import { X, UserPlus, Briefcase, Crown, Users, Search } from 'lucide-react';
import { Button } from '../ui/button';
import AppModal from '../ui/AppModal';
import Avatar from '../ui/Avatar';
import { cn } from '../../lib/utils';

const ROLE_OPTIONS = [
  { value: 'sales_manager', label: 'Sales Manager', icon: Briefcase, desc: 'Oversee and distribute leads' },
  { value: 'team_leader', label: 'Team Leader', icon: Crown, desc: 'Manage team and assign to executives' },
  { value: 'sales_executive', label: 'Sales Executive', icon: Users, desc: 'Handle lead directly' },
];

export default function AdminAssignLeadModal({
  open,
  lead,
  assignees,
  loading,
  onClose,
  onAssign,
  allowedRoles = ['sales_manager', 'team_leader', 'sales_executive'],
}) {
  const isBulk = lead?.bulk;
  const roleOptions = ROLE_OPTIONS.filter((r) => allowedRoles.includes(r.value));
  const defaultRole = roleOptions[0]?.value || 'sales_executive';
  const [role, setRole] = useState(defaultRole);
  const [assigneeId, setAssigneeId] = useState('');
  const [userSearch, setUserSearch] = useState('');

  useEffect(() => {
    if (open) {
      setRole(defaultRole);
      setAssigneeId('');
      setUserSearch('');
    }
  }, [open, defaultRole]);

  const people =
    role === 'sales_manager'
      ? assignees?.salesManagers || []
      : role === 'team_leader'
        ? assignees?.teamLeaders || []
        : assignees?.salesExecutives || [];

  const filteredPeople = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return people;
    return people.filter((person) => {
      const name = String(person.name || '').toLowerCase();
      const email = String(person.email || '').toLowerCase();
      const phone = String(person.phone || '').toLowerCase();
      return name.includes(q) || email.includes(q) || phone.includes(q);
    });
  }, [people, userSearch]);

  const handleClose = () => {
    setRole(defaultRole);
    setAssigneeId('');
    setUserSearch('');
    onClose();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!assigneeId) return;
    const leadIds = isBulk ? lead.leadIds : [lead._id];
    onAssign({ assigneeRole: role, assigneeId, leadIds });
    setAssigneeId('');
  };

  const handleRoleChange = (nextRole) => {
    setRole(nextRole);
    setAssigneeId('');
    setUserSearch('');
  };

  return (
    <AppModal open={open} onClose={handleClose} size="md" className="overflow-hidden">
      <form onSubmit={handleSubmit}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-subtle">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-violet-600" />
            {isBulk ? `Assign ${lead?.count} Leads` : 'Assign Lead'}
          </h2>
          <button type="button" onClick={handleClose} className="p-2 rounded-xl hover:bg-surface-elevated">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {!isBulk && lead && (
            <div className="p-3 rounded-xl bg-surface-elevated/50 border border-subtle text-sm">
              <p className="font-semibold text-content-primary">{lead.name}</p>
              <p className="text-content-muted">{lead.destination} · {lead.sourceLabel || lead.source}</p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-content-muted mb-2">
              Assign to role
            </label>
            <div className={`grid grid-cols-1 gap-2 ${roleOptions.length > 1 ? 'sm:grid-cols-3' : ''}`}>
              {roleOptions.map((opt) => {
                const Icon = opt.icon;
                const selected = role === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleRoleChange(opt.value)}
                    className={cn(
                      'p-3 rounded-xl border text-left transition-all',
                      selected
                        ? 'border-violet-500/40 bg-violet-500/10 ring-2 ring-violet-500/20'
                        : 'border-subtle bg-surface-elevated/40 hover:border-violet-500/25'
                    )}
                  >
                    <Icon className={cn('w-4 h-4 mb-1.5', selected ? 'text-violet-600' : 'text-content-muted')} />
                    <p className="text-xs font-semibold text-content-primary">{opt.label}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-content-muted mb-1.5">
              Select {roleOptions.find((r) => r.value === role)?.label}
            </label>
            {loading ? (
              <p className="text-sm text-content-muted py-2">Loading team members…</p>
            ) : people.length === 0 ? (
              <p className="text-sm text-amber-600 py-2">No active users found for this role.</p>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted" />
                  <input
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search user by name, email, or phone…"
                    className="w-full h-10 pl-9 pr-3 rounded-xl border border-subtle bg-white text-sm outline-none focus:ring-2 focus:ring-violet-500/30"
                  />
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {filteredPeople.length === 0 ? (
                    <p className="text-sm text-content-muted py-2">No users match “{userSearch.trim()}”.</p>
                  ) : (
                    filteredPeople.map((person) => {
                      const selected = assigneeId === person._id;
                      return (
                        <button
                          key={person._id}
                          type="button"
                          onClick={() => setAssigneeId(person._id)}
                          className={cn(
                            'w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all',
                            selected
                              ? 'border-brand-500/40 bg-brand-500/10 ring-2 ring-brand-500/20'
                              : 'border-subtle hover:bg-surface-elevated'
                          )}
                        >
                          <Avatar name={person.name} size="sm" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-content-primary truncate">{person.name}</p>
                            <p className="text-xs text-content-muted truncate">{person.email || person.roleName}</p>
                          </div>
                          {selected && (
                            <span className="text-[10px] font-bold uppercase text-brand-600 bg-brand-500/15 px-2 py-0.5 rounded-full shrink-0">
                              Selected
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!assigneeId || loading}>
              Confirm Assignment
            </Button>
          </div>
        </div>
      </form>
    </AppModal>
  );
}
