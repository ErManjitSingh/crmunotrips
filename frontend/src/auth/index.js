export { authService, AuthError } from './authService';
export { authStorage } from './authStorage';
export {
  AUTH_STORAGE_KEYS,
  VALID_ROLES,
  ROLE_DASHBOARD_PATHS,
  ROLE_LABELS,
  LEAD_PROVIDER_BLOCKED_ROLE_SLUGS,
} from './constants';

/** Demo login shortcuts (seed accounts) — password from SEED_PASSWORD / 123456 */
export const LOGIN_PRESETS = [
  { name: 'Admin', email: 'admin@crm.com', password: '123456', role: 'admin', roleName: 'Admin' },
  {
    name: 'Operations',
    email: 'ops@crm.com',
    password: '123456',
    role: 'operations_manager',
    roleName: 'Operations Manager',
  },
];
