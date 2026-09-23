/**
 * The Cold Calling role (role only — no workflow) and its consistency with the backend config.
 * Run with: node --test src/lib/__tests__/coldCallingRole.test.js
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import {
  VALID_ROLES,
  ROLE_LABELS,
  ROLE_DASHBOARD_PATHS,
  LEAD_PROVIDER_BLOCKED_ROLE_SLUGS,
} from '../../auth/constants.js';
import { getPermissionsForRole } from '../rolePermissions.js';

const require = createRequire(import.meta.url);
const backendRoles = require('../../../../backend/src/config/roles.js');
const backendPermissions = require('../../../../backend/src/config/permissions.js');

const EXISTING_ROLES = [
  'admin', 'sales_manager', 'sales_executive', 'team_leader', 'accountant', 'operations_manager', 'hr_admin', 'lead_provider',
];
const allFalse = (perms) => Object.values(perms).every((block) => Object.values(block).every((v) => v === false));

test('cold_calling is a valid role and displays as "Cold Calling"', () => {
  assert.ok(VALID_ROLES.includes('cold_calling'));
  assert.equal(ROLE_LABELS.cold_calling, 'Cold Calling');
});

test('existing roles and their labels are unchanged', () => {
  assert.deepEqual(VALID_ROLES.filter((r) => r !== 'cold_calling'), EXISTING_ROLES);
  assert.equal(ROLE_LABELS.admin, 'Admin');
  assert.equal(ROLE_LABELS.hr_admin, 'HR Admin');
  assert.equal(ROLE_LABELS.sales_executive, 'Sales Executive');
  assert.equal(ROLE_DASHBOARD_PATHS.admin, '/admin/dashboard');
});

test('every valid role has a label and a dashboard path (a missing path would loop on "/")', () => {
  for (const role of VALID_ROLES) {
    assert.ok(ROLE_LABELS[role], `label for ${role}`);
    assert.ok(ROLE_DASHBOARD_PATHS[role], `dashboard path for ${role}`);
    assert.notEqual(ROLE_DASHBOARD_PATHS[role], '/');
  }
  assert.equal(ROLE_DASHBOARD_PATHS.cold_calling, '/cold-calling');
});

test('Cold Calling has no permissions on the frontend either', () => {
  assert.equal(allFalse(getPermissionsForRole('cold_calling')), true);
});

test('a Lead Provider cannot assign the Cold Calling role (or the other privileged roles)', () => {
  for (const slug of ['cold_calling', 'admin', 'hr_admin', 'lead_provider']) {
    assert.ok(LEAD_PROVIDER_BLOCKED_ROLE_SLUGS.includes(slug), slug);
  }
  assert.equal(LEAD_PROVIDER_BLOCKED_ROLE_SLUGS.includes('sales_executive'), false);
});

test('frontend and backend agree on roles, labels, dashboard paths and Cold Calling permissions', () => {
  assert.deepEqual([...VALID_ROLES].sort(), [...backendRoles.ROLES].sort());
  assert.deepEqual(ROLE_LABELS, backendRoles.ROLE_LABELS);
  assert.deepEqual(ROLE_DASHBOARD_PATHS, backendRoles.ROLE_DASHBOARD_PATHS);
  assert.deepEqual(getPermissionsForRole('cold_calling'), backendPermissions.getPermissionsForRole('cold_calling'));
});
