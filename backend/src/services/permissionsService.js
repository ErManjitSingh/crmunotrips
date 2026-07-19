const Role = require('../models/Role');
const { getPermissionsForRole } = require('../config/permissions');

const rolePermCache = new Map();
const ROLE_PERM_CACHE_MS = 5 * 60_000;

function mergePermissions(stored, defaults) {
  const merged = { ...defaults };
  for (const key of Object.keys(defaults)) {
    merged[key] = { ...defaults[key], ...(stored?.[key] || {}) };
  }
  return merged;
}

function invalidateRolePermissions(roleId) {
  if (!roleId) {
    rolePermCache.clear();
    return;
  }
  rolePermCache.delete(String(roleId));
}

async function resolveUserPermissions(user) {
  const defaults = getPermissionsForRole(user?.role);
  if (!user) return defaults;
  if (!user.roleId) return defaults;

  const key = String(user.roleId);
  const hit = rolePermCache.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return mergePermissions(hit.permissions, defaults);
  }

  const role = await Role.findById(user.roleId).select('permissions').lean();
  if (role?.permissions) {
    rolePermCache.set(key, {
      permissions: role.permissions,
      expiresAt: Date.now() + ROLE_PERM_CACHE_MS,
    });
    return mergePermissions(role.permissions, defaults);
  }
  return defaults;
}

module.exports = { resolveUserPermissions, invalidateRolePermissions };
