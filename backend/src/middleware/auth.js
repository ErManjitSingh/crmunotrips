const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');
const { getPermissionsForRole } = require('../config/permissions');
const { resolveUserPermissions } = require('../services/permissionsService');
const { ROLE_LABELS, ROLE_DASHBOARD_PATHS } = require('../config/roles');

const userCache = new Map();
const USER_CACHE_MS = 45_000;

async function loadAuthUser(userId) {
  const key = String(userId);
  const hit = userCache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.user;

  const user = await User.findById(userId).select('-password');
  if (user) {
    userCache.set(key, { user, expiresAt: Date.now() + USER_CACHE_MS });
  }
  return user;
}

const protect = asyncHandler(async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) throw new ApiError(401, 'Not authorized, no token');

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const user = await loadAuthUser(decoded.id);
  if (!user || user.status === 'disabled') throw new ApiError(401, 'User not found or disabled');

  const branchIdFromHeader = req.headers['x-branch-id'];
  const branchIdFromQuery = typeof req.query?.branchId === 'string' ? req.query.branchId.trim() : '';
  const requestedBranchId = branchIdFromQuery || branchIdFromHeader || null;
  const userBranchId = user.branchId?.toString?.();
  // HR portal is company-wide — do not block on branch header/query mismatch
  const skipBranchGuard = user.role === 'admin' || user.role === 'hr_admin';
  if (!skipBranchGuard && requestedBranchId && requestedBranchId !== userBranchId) {
    throw new ApiError(403, 'Access denied for selected branch');
  }

  req.user = user;
  req.permissions = await resolveUserPermissions(user);
  req.branchId =
    user.role === 'admin' || user.role === 'hr_admin'
      ? requestedBranchId || userBranchId || null
      : userBranchId || null;
  if (req.branchId) {
    res.setHeader('x-branch-id', req.branchId.toString());
  }
  next();
});

function formatUserResponse(user, permissions) {
  const obj = user.toObject ? user.toObject() : user;
  const perms = permissions || getPermissionsForRole(obj.role);
  return {
    _id: obj._id,
    id: obj._id,
    name: obj.name,
    email: obj.email,
    phone: obj.phone,
    role: obj.role,
    roleId: obj.roleId,
    roleName: ROLE_LABELS[obj.role] || obj.role,
    department: obj.department,
    status: obj.status,
    branchId: obj.branchId || null,
    allowedBranchIds: obj.role === 'admin' ? [] : (obj.branchId ? [obj.branchId] : []),
    teamId: obj.teamId,
    permissions: perms,
    dashboardPath: ROLE_DASHBOARD_PATHS[obj.role] || '/',
    executiveName: obj.role === 'sales_executive' ? obj.name : undefined,
    teamLeaderName: obj.role === 'team_leader' ? obj.name : undefined,
  };
}

const RESTRICTED_SESSION_ROLES = ['admin', 'sales_manager'];

const generateToken = (id, role) => {
  const restricted = RESTRICTED_SESSION_ROLES.includes(role);
  const expiresIn = restricted
    ? process.env.JWT_EXPIRES_IN_RESTRICTED || '30m'
    : process.env.JWT_EXPIRES_IN || '30d';
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn });
};

const RESTRICTED_SESSION_MS = 30 * 60 * 1000;

function getRestrictedSessionMeta(role) {
  if (!RESTRICTED_SESSION_ROLES.includes(role)) return {};
  return {
    sessionExpiresAt: new Date(Date.now() + RESTRICTED_SESSION_MS).toISOString(),
    sessionTimeoutMinutes: 30,
  };
}

module.exports = {
  protect,
  formatUserResponse,
  generateToken,
  getRestrictedSessionMeta,
  RESTRICTED_SESSION_ROLES,
};
