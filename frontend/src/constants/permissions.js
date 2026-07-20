/** Permission modules for Team / Role Management UI (mirrors backend Role schema). */
export const PERMISSION_MODULES = {
  users: { label: 'Users & Roles', actions: ['view', 'create', 'edit', 'delete'] },
  leads: { label: 'Leads & Follow-ups', actions: ['view', 'create', 'edit', 'delete'] },
  customers: { label: 'Customers', actions: ['view', 'create', 'edit', 'delete'] },
  quotations: { label: 'Quotations', actions: ['view', 'create', 'edit', 'delete', 'approve'] },
  reports: { label: 'Reports', actions: ['view', 'export'] },
  packages: { label: 'Packages & Inventory', actions: ['view', 'create', 'edit', 'delete'] },
  payments: { label: 'Payments', actions: ['view', 'create', 'edit', 'delete'] },
  operations: { label: 'Operations', actions: ['view', 'create', 'edit', 'delete'] },
  hr: { label: 'HR Management', actions: ['view', 'create', 'edit', 'delete'] },
  whatsapp: { label: 'WhatsApp', actions: ['use', 'manage'] },
  email: { label: 'Email', actions: ['send', 'manage'] },
};
