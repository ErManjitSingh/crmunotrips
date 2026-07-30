import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Shield, Activity, Trophy, Plus, Search, UserCheck, UserX, Send } from 'lucide-react';
import API from '../../api/axios';
import PageHeader from '../ui/PageHeader';
import { Button } from '../ui/button';
import { usePermissions } from '../../hooks/usePermissions';
import UserDataTable from './UserDataTable';
import UserFormModal from './UserFormModal';
import InviteUserModal from './InviteUserModal';
import UserDetailDrawer from './UserDetailDrawer';
import RoleManager from './RoleManager';
import ActivityLogPanel from './ActivityLogPanel';
import TeamPerformanceDashboard from './TeamPerformanceDashboard';
import SetMonthlyTargetModal from '../sales-targets/SetMonthlyTargetModal';
import { DEPARTMENTS, TABS } from './constants';
import { toast } from '../../context/ToastContext';
import { useDataRefresh } from '../../hooks/useDataRefresh';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useAuth } from '../../context/AuthContext';

const tabIcons = { Users, Shield, Activity, Trophy };
const emptyFilters = { search: '', status: '', roleId: '', department: '' };
const emptyActivityFilters = { search: '', type: '' };

const TARGET_SETTER_ROLES = new Set(['admin', 'sales_manager', 'team_leader']);
const TARGET_USER_ROLES = new Set(['sales_executive', 'team_leader']);

function canSetTargetFor(authRole, targetRole) {
  if (!TARGET_SETTER_ROLES.has(authRole)) return false;
  if (authRole === 'team_leader') return targetRole === 'sales_executive';
  return TARGET_USER_ROLES.has(targetRole);
}

export default function TeamManagementPage() {
  const { can } = usePermissions();
  const { user: authUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [togglingUserId, setTogglingUserId] = useState(null);
  const initialTab = searchParams.get('tab') || 'users';
  const [tab, setTab] = useState(initialTab);
  const [users, setUsers] = useState([]);
  const [usersPagination, setUsersPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [roles, setRoles] = useState([]);
  const [logs, setLogs] = useState([]);
  const [performance, setPerformance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(emptyFilters);
  const [activityFilters, setActivityFilters] = useState(emptyActivityFilters);
  const [modalOpen, setModalOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [drawerUser, setDrawerUser] = useState(null);
  const [targetUser, setTargetUser] = useState(null);
  const { confirm, dialogNode } = useConfirmDialog();

  const canSetTargets = TARGET_SETTER_ROLES.has(authUser?.role);

  const fetchUsers = useCallback(() => {
    const params = {
      page: usersPagination.page,
      limit: usersPagination.limit,
      ...(filters.search ? { search: filters.search } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.roleId ? { roleId: filters.roleId } : {}),
      ...(filters.department ? { department: filters.department } : {}),
    };
    return API.get('/users', { params }).then((r) => {
      setUsers(r.data?.data || []);
      setUsersPagination((prev) => ({
        ...prev,
        ...(r.data?.pagination || {}),
      }));
    });
  }, [filters, usersPagination.page, usersPagination.limit]);
  const fetchRoles = useCallback(() => API.get('/roles').then((r) => setRoles(r.data)), []);
  const fetchLogs = useCallback(() => API.get('/activity-logs', { params: activityFilters }).then((r) => setLogs(r.data)), [activityFilters]);
  const fetchPerformance = useCallback(() => API.get('/team/performance').then((r) => setPerformance(r.data)), []);

  const fetchAll = useCallback(() => {
    setLoading(true);
    Promise.all([fetchUsers(), fetchRoles(), fetchLogs(), fetchPerformance()]).finally(() => setLoading(false));
  }, [fetchUsers, fetchRoles, fetchLogs, fetchPerformance]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useDataRefresh(['users', 'roles', 'team', 'activity'], fetchAll);
  useEffect(() => { if (tab === 'activity') fetchLogs(); }, [tab, activityFilters, fetchLogs]);
  useEffect(() => {
    if (tab === 'users') fetchUsers();
  }, [fetchUsers, tab]);

  useEffect(() => {
    setUsersPagination((prev) => (prev.page === 1 ? prev : { ...prev, page: 1 }));
  }, [filters.search, filters.status, filters.roleId, filters.department]);

  const kpis = useMemo(() => ({
    total: usersPagination.total,
    active: users.filter((u) => u.status === 'active').length,
    disabled: users.filter((u) => u.status === 'disabled').length,
    roles: roles.length,
  }), [users, roles, usersPagination.total]);

  const handleSaveUser = async (data) => {
    try {
      if (editUser) await API.put(`/users/${editUser._id}`, data, { skipErrorToast: true });
      else await API.post('/users', data, { skipErrorToast: true });
      setEditUser(null);
      await Promise.all([fetchUsers(), fetchRoles(), fetchLogs()]);
    } catch {
      /* toast via axios */
    }
  };

  const handleResetPassword = async (user) => {
    const ok = await confirm({
      title: 'Reset password?',
      message: `Reset password for ${user.email}? A temporary password will be generated.`,
      confirmLabel: 'Reset Password',
      cancelLabel: 'Cancel',
      tone: 'warning',
    });
    if (!ok) return;
    const res = await API.post(`/users/reset-password/${user._id}`, null, { skipSuccessToast: true });
    const temp = res.data?.temporaryPassword;
    toast.info(
      temp
        ? `Password has been reset.\n\nTemporary password for ${user.email}:\n${temp}\n\nShare it securely with the user.`
        : res.data?.message || 'Password has been reset',
      10000
    );
    fetchLogs();
  };

  const handleToggleStatus = async (user) => {
    if (String(user._id) === String(authUser?._id)) {
      toast.error('You cannot change your own account status');
      return;
    }
    if (user.status === 'invited') {
      toast.error('Invited users must accept the invite before activation');
      return;
    }

    const activating = user.status !== 'active';
    const ok = await confirm({
      title: activating ? 'Activate user?' : 'Deactivate user?',
      message: activating
        ? `${user.name} will be able to log in and receive leads again.`
        : `${user.name} will be logged out and cannot sign in until reactivated.`,
      confirmLabel: activating ? 'Activate' : 'Deactivate',
      cancelLabel: 'Cancel',
      tone: activating ? 'default' : 'warning',
    });
    if (!ok) return;

    setTogglingUserId(user._id);
    try {
      const res = await API.patch(`/users/${user._id}/toggle-status`, {
        status: activating ? 'active' : 'disabled',
      });
      const updated = res.data;
      setUsers((prev) => prev.map((u) => (u._id === user._id ? { ...u, ...updated } : u)));
      if (drawerUser?._id === user._id) {
        setDrawerUser((prev) => (prev ? { ...prev, ...updated } : prev));
      }
      toast.success(activating ? `${user.name} is now active` : `${user.name} has been deactivated`);
      fetchLogs();
    } catch {
      /* toast via axios */
    } finally {
      setTogglingUserId(null);
    }
  };

  const handleDelete = async (user) => {
    const ok = await confirm({
      title: 'Delete user permanently?',
      message: `Delete ${user.name}? This action cannot be undone.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await API.delete(`/users/${user._id}`);
      fetchUsers();
      fetchLogs();
    } catch {
      /* toast via axios */
    }
  };

  const handleCreateRole = async (data) => {
    await API.post('/roles', data);
    fetchRoles();
    fetchLogs();
  };

  const handleUpdateRole = async (id, data) => {
    await API.put(`/roles/${id}`, data, { skipSuccessToast: true });
    await fetchRoles();
  };

  const handleDeleteRole = async (id) => {
    const ok = await confirm({
      title: 'Delete role?',
      message: 'This role will be removed permanently.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await API.delete(`/roles/${id}`);
      fetchRoles();
    } catch {
      /* toast via axios */
    }
  };

  const visibleTabs = useMemo(() => TABS.filter((t) => {
    if (t.id === 'performance') return can('reports', 'view') || canSetTargets;
    return can('users', 'view');
  }), [can, canSetTargets]);

  const handleInvite = async (data) => {
    const res = await API.post('/users/invite', data);
    fetchUsers();
    fetchLogs();
    return res.data;
  };

  const isAdmin = authUser?.role === 'admin';
  const userActions = {
    canEdit: can('users', 'edit'),
    canDelete: can('users', 'delete'),
    canManage: can('users', 'edit'),
    canToggleStatus: isAdmin,
  };

  return (
    <div>
      <PageHeader
        title={tab === 'roles' ? 'Role Management' : 'User Management & RBAC'}
        description={
          tab === 'roles'
            ? 'Select a role, toggle module permissions, then save'
            : tab === 'performance'
              ? 'Set Target / Package / Total sales / Profit for executives and team leaders'
              : 'Enterprise-grade access control, roles, and team performance'
        }
        breadcrumbs={
          tab === 'roles'
            ? ['Admin', 'Role Management']
            : tab === 'performance'
              ? ['Team', 'Sales Targets']
              : ['Team', 'User Management']
        }
        actions={
          tab === 'users' && can('users', 'create') ? (
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setInviteOpen(true)}>
                <Send className="w-4 h-4 mr-1.5" /> Invite User
              </Button>
              <Button onClick={() => { setEditUser(null); setModalOpen(true); }}>
                <Plus className="w-4 h-4 mr-1.5" /> Add User
              </Button>
            </div>
          ) : null
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total Users', value: kpis.total, icon: Users, iconClass: 'text-brand-600', bgClass: 'bg-brand-500/10' },
          { label: 'Active', value: kpis.active, icon: UserCheck, iconClass: 'text-emerald-600', bgClass: 'bg-emerald-500/10' },
          { label: 'Disabled', value: kpis.disabled, icon: UserX, iconClass: 'text-rose-600', bgClass: 'bg-rose-500/10' },
          { label: 'Roles', value: kpis.roles, icon: Shield, iconClass: 'text-violet-600', bgClass: 'bg-violet-500/10' },
        ].map(({ label, value, icon: Icon, iconClass, bgClass }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-xl border border-subtle bg-surface/60 backdrop-blur-xl px-4 py-3 flex items-center gap-3"
          >
            <div className={`p-2 rounded-lg ${bgClass}`}>
              <Icon className={`w-4 h-4 ${iconClass}`} />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-content-muted">{label}</p>
              <p className="text-lg font-bold text-content-primary tabular-nums">{value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6 p-1 rounded-xl bg-surface-elevated/50 border border-subtle w-fit">
        {visibleTabs.map(({ id, label, icon }) => {
          const Icon = tabIcons[icon];
          return (
            <button
              key={id}
              type="button"
              onClick={() => {
                setTab(id);
                setSearchParams(id === 'users' ? {} : { tab: id }, { replace: true });
              }}
              className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === id ? 'text-brand-600' : 'text-content-muted hover:text-content-primary'}`}
            >
              {tab === id && (
                <motion.div layoutId="team-tab" className="absolute inset-0 bg-surface rounded-lg shadow-sm border border-subtle" transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }} />
              )}
              <span className="relative flex items-center gap-2">
                <Icon className="w-4 h-4" /> {label}
              </span>
            </button>
          );
        })}
      </div>

      {loading && tab === 'users' ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
            {tab === 'users' && (
              <div className="space-y-4">
                <div className="flex flex-col lg:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-muted" />
                    <input
                      value={filters.search}
                      onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                      placeholder="Search users by name or email…"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-subtle bg-surface/80 backdrop-blur-xl text-sm focus:ring-2 focus:ring-brand-500/30 outline-none"
                    />
                  </div>
                  <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="px-4 py-2.5 rounded-xl border border-subtle bg-surface/80 text-sm outline-none">
                    <option value="">All Status</option>
                    <option value="active">Active</option>
                    <option value="disabled">Disabled</option>
                    <option value="invited">Invited</option>
                  </select>
                  <select value={filters.roleId} onChange={(e) => setFilters({ ...filters, roleId: e.target.value })} className="px-4 py-2.5 rounded-xl border border-subtle bg-surface/80 text-sm outline-none">
                    <option value="">All Roles</option>
                    {roles.map((r) => <option key={r._id} value={r._id}>{r.name}</option>)}
                  </select>
                  <select value={filters.department} onChange={(e) => setFilters({ ...filters, department: e.target.value })} className="px-4 py-2.5 rounded-xl border border-subtle bg-surface/80 text-sm outline-none">
                    <option value="">All Departments</option>
                    {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <UserDataTable
                  users={users}
                  permissions={userActions}
                  currentUserId={authUser?._id}
                  currentUserRole={authUser?.role}
                  togglingUserId={togglingUserId}
                  onEdit={userActions.canEdit ? (u) => { setEditUser(u); setModalOpen(true); } : undefined}
                  onView={setDrawerUser}
                  onResetPassword={userActions.canManage ? handleResetPassword : undefined}
                  onToggleStatus={userActions.canToggleStatus ? handleToggleStatus : undefined}
                  onDelete={userActions.canDelete ? handleDelete : undefined}
                  onSetTarget={canSetTargets ? (u) => {
                    if (!canSetTargetFor(authUser?.role, u.role)) return;
                    setTargetUser({
                      ...u,
                      userId: u._id,
                      revenueTarget: u.revenueTarget,
                      monthlyTarget: u.monthlyTarget,
                    });
                  } : undefined}
                />
                <div className="flex items-center justify-between px-1">
                  <p className="text-xs text-content-muted">
                    Showing page {usersPagination.page} of {Math.max(usersPagination.totalPages || 1, 1)}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={usersPagination.page <= 1}
                      onClick={() => setUsersPagination((p) => ({ ...p, page: p.page - 1 }))}
                    >
                      Prev
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={usersPagination.page >= (usersPagination.totalPages || 1)}
                      onClick={() => setUsersPagination((p) => ({ ...p, page: p.page + 1 }))}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </div>
            )}
            {tab === 'roles' && can('users', 'view') && (
              <RoleManager
                roles={roles}
                canCreate={can('users', 'create')}
                canEdit={can('users', 'edit')}
                canDelete={can('users', 'delete')}
                onCreateRole={handleCreateRole}
                onUpdateRole={handleUpdateRole}
                onDeleteRole={handleDeleteRole}
              />
            )}
            {tab === 'activity' && (
              <ActivityLogPanel logs={logs} filters={activityFilters} onFilterChange={setActivityFilters} />
            )}
            {tab === 'performance' && (
              <TeamPerformanceDashboard
                data={performance}
                canSetTargets={canSetTargets}
                currentUserRole={authUser?.role}
              />
            )}
          </motion.div>
        </AnimatePresence>
      )}

      <UserFormModal open={modalOpen} onClose={() => { setModalOpen(false); setEditUser(null); }} onSave={handleSaveUser} user={editUser} roles={roles} />
      <InviteUserModal open={inviteOpen} onClose={() => setInviteOpen(false)} onInvite={handleInvite} roles={roles} />
      <SetMonthlyTargetModal
        open={!!targetUser}
        user={targetUser}
        onClose={() => setTargetUser(null)}
        onSaved={() => {
          if (tab === 'performance') fetchPerformance();
        }}
      />
      <UserDetailDrawer
        user={drawerUser}
        open={!!drawerUser}
        onClose={() => setDrawerUser(null)}
        onEdit={userActions.canEdit ? (u) => { setDrawerUser(null); setEditUser(u); setModalOpen(true); } : undefined}
        onToggleStatus={userActions.canToggleStatus ? handleToggleStatus : undefined}
        currentUserId={authUser?._id}
        togglingUserId={togglingUserId}
      />
      {dialogNode}
    </div>
  );
}
