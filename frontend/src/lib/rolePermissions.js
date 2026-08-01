/** Mirrors backend/src/config/permissions.js — used when session user lacks permissions blob */
const noPerms = () => ({
  users: { view: false, create: false, edit: false, delete: false },
  leads: { view: false, create: false, edit: false, delete: false },
  customers: { view: false, create: false, edit: false, delete: false },
  quotations: { view: false, create: false, edit: false, delete: false, approve: false },
  reports: { view: false, export: false },
  packages: { view: false, create: false, edit: false, delete: false },
  payments: { view: false, create: false, edit: false, delete: false },
  operations: { view: false, create: false, edit: false, delete: false },
  hr: { view: false, create: false, edit: false, delete: false },
  whatsapp: { use: false, manage: false },
  email: { send: false, manage: false },
});

const fullPerms = () => ({
  users: { view: true, create: true, edit: true, delete: true },
  leads: { view: true, create: true, edit: true, delete: true },
  customers: { view: true, create: true, edit: true, delete: true },
  quotations: { view: true, create: false, edit: false, delete: false, approve: false },
  reports: { view: true, export: true },
  packages: { view: true, create: true, edit: true, delete: true },
  payments: { view: true, create: true, edit: true, delete: true },
  operations: { view: true, create: true, edit: true, delete: true },
  hr: { view: true, create: true, edit: true, delete: true },
  whatsapp: { use: true, manage: true },
  email: { send: true, manage: true },
});

const adminPerms = () => {
  const perms = fullPerms();
  perms.hr = { view: false, create: false, edit: false, delete: false };
  return perms;
};

const ROLE_PERMISSIONS = {
  admin: adminPerms(),
  sales_manager: {
    ...noPerms(),
    users: { view: true, create: false, edit: false, delete: false },
    leads: { view: true, create: true, edit: true, delete: false },
    customers: { view: true, create: true, edit: true, delete: false },
    quotations: { view: true, create: true, edit: true, delete: false, approve: true },
    reports: { view: true, export: true },
    packages: { view: true, create: false, edit: false, delete: false },
    whatsapp: { use: true, manage: false },
    email: { send: true, manage: false },
  },
  team_leader: {
    ...noPerms(),
    leads: { view: true, create: false, edit: true, delete: false },
    customers: { view: true, create: false, edit: false, delete: false },
    quotations: { view: true, create: true, edit: true, delete: false, approve: true },
    reports: { view: true, export: true },
    packages: { view: true, create: false, edit: false, delete: false },
    users: { view: true, create: false, edit: false, delete: false },
    whatsapp: { use: true, manage: false },
    email: { send: true, manage: false },
  },
  sales_executive: {
    ...noPerms(),
    leads: { view: true, create: true, edit: true, delete: false },
    customers: { view: true, create: false, edit: false, delete: false },
    quotations: { view: true, create: true, edit: true, delete: false, approve: false },
    reports: { view: true, export: false },
    packages: { view: true, create: false, edit: false, delete: false },
    whatsapp: { use: true, manage: false },
    email: { send: true, manage: false },
  },
  accountant: {
    ...noPerms(),
    quotations: { view: true, create: false, edit: false, delete: false, approve: true },
    reports: { view: true, export: true },
    payments: { view: true, create: true, edit: true, delete: false },
  },
  operations_manager: {
    ...noPerms(),
    packages: { view: true, create: true, edit: true, delete: true },
    operations: {
      view: true,
      create: true,
      edit: true,
      delete: true,
      manage_hotels: true,
      manage_vendors: true,
      manage_transport: true,
      generate_voucher: true,
      manage_payments: true,
      view_reports: true,
    },
    leads: { view: true, create: false, edit: false, delete: false },
    reports: { view: true, export: true },
  },
  hr_admin: {
    ...noPerms(),
    hr: { view: true, create: true, edit: true, delete: true },
    reports: { view: true, export: true },
  },
  lead_provider: {
    ...noPerms(),
    leads: { view: true, create: true, edit: true, delete: false },
  },
};

export function getPermissionsForRole(role) {
  return ROLE_PERMISSIONS[role] || noPerms();
}
