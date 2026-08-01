export const AUTH_STORAGE_KEYS = {
  USER: 'user',
  ROLE: 'role',
  IS_AUTHENTICATED: 'isAuthenticated',
  SESSION_EXPIRES_AT: 'sessionExpiresAt',
  LAST_ACTIVITY_AT: 'lastActivityAt',
};

/** @typedef {'admin'|'sales_manager'|'sales_executive'|'team_leader'|'accountant'|'operations_manager'|'hr_admin'|'lead_provider'} RoleSlug */

export const VALID_ROLES = /** @type {RoleSlug[]} */ ([
  'admin',
  'sales_manager',
  'sales_executive',
  'team_leader',
  'accountant',
  'operations_manager',
  'hr_admin',
  'lead_provider',
]);

/** @type {Record<RoleSlug, string>} */
export const ROLE_DASHBOARD_PATHS = {
  admin: '/admin/dashboard',
  sales_manager: '/sales-manager/dashboard',
  sales_executive: '/sales-executive/dashboard',
  team_leader: '/team-leader/dashboard',
  accountant: '/accountant/dashboard',
  operations_manager: '/operations-manager/dashboard',
  hr_admin: '/hr/dashboard',
  lead_provider: '/leads',
};

export const ROLE_LABELS = {
  admin: 'Admin',
  sales_manager: 'Sales Manager',
  sales_executive: 'Sales Executive',
  team_leader: 'Team Leader',
  accountant: 'Accountant',
  operations_manager: 'Operations Manager',
  hr_admin: 'HR Admin',
  lead_provider: 'Lead Provider',
};
