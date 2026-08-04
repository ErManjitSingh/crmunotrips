const ROLES = [
  'admin',
  'sales_manager',
  'team_leader',
  'sales_executive',
  'accountant',
  'operations_manager',
  'hr_admin',
  'lead_provider',
];

const ROLE_LABELS = {
  admin: 'Admin',
  sales_manager: 'Sales Manager',
  team_leader: 'Team Leader',
  sales_executive: 'Sales Executive',
  accountant: 'Accountant',
  operations_manager: 'Operations Manager',
  hr_admin: 'HR Admin',
  lead_provider: 'Lead Provider',
};

const ROLE_DASHBOARD_PATHS = {
  admin: '/admin/dashboard',
  sales_manager: '/sales-manager/dashboard',
  sales_executive: '/sales-executive/dashboard',
  team_leader: '/team-leader/dashboard',
  accountant: '/accountant/dashboard',
  operations_manager: '/operations-manager/dashboard',
  hr_admin: '/hr/dashboard',
  lead_provider: '/admin/dashboard',
};

module.exports = { ROLES, ROLE_LABELS, ROLE_DASHBOARD_PATHS };
