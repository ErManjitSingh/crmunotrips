export { PERMISSION_MODULES } from '../../constants/permissions';

export const DEPARTMENTS = ['Management', 'Sales', 'Operations', 'Finance', 'Support'];

export const USER_STATUSES = [
  { value: 'active', label: 'Active', color: 'emerald' },
  { value: 'disabled', label: 'Disabled', color: 'rose' },
  { value: 'invited', label: 'Invited', color: 'amber' },
];

export const ACTIVITY_TYPES = [
  { value: 'login', label: 'Login', icon: 'LogIn' },
  { value: 'logout', label: 'Logout', icon: 'LogOut' },
  { value: 'lead_created', label: 'Lead Created', icon: 'UserPlus' },
  { value: 'lead_updated', label: 'Lead Updated', icon: 'Pencil' },
  { value: 'quotation_created', label: 'Quotation Created', icon: 'FileText' },
  { value: 'user_action', label: 'User Management', icon: 'Shield' },
];

export const TABS = [
  { id: 'users', label: 'Users', icon: 'Users' },
  { id: 'roles', label: 'Role Management', icon: 'Shield' },
  { id: 'activity', label: 'Activity Log', icon: 'Activity' },
  { id: 'performance', label: 'Sales Targets', icon: 'Trophy' },
];

export function formatLastLogin(value) {
  if (!value) return 'Never';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatCurrency(amount) {
  const n = Number(amount) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}
