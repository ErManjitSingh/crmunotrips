const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { UAParser } = require('ua-parser-js');
const User = require('../models/User');
const UserSession = require('../models/UserSession');
const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');
const { getPermissionsForRole } = require('../config/permissions');
const { resolveUserPermissions } = require('../services/permissionsService');
const { ROLE_LABELS, ROLE_DASHBOARD_PATHS } = require('../config/roles');
const {
  getForcedLogoutCutoff,
  isPastForcedLogoutTime,
  formatClockLabel,
  EOD_HOUR,
  EOD_MINUTE,
  SESSION_WINDOW_ROLES,
} = require('../utils/orgTimezone');
const { getClientIp } = require('../services/activityService');
const { assertRoleMayCall } = require('./restrictedRoleAccess');

const userCache = new Map();
const USER_CACHE_MS = 45_000;
const USER_CACHE_MAX = 1000;

function trimUserCache() {
  const now = Date.now();
  for (const [key, entry] of userCache) {
    if (entry.expiresAt <= now) userCache.delete(key);
  }
  while (userCache.size >= USER_CACHE_MAX) {
    const oldestKey = userCache.keys().next().value;
    if (oldestKey === undefined) break;
    userCache.delete(oldestKey);
  }
}

async function loadAuthUser(userId) {
  const key = String(userId);
  const hit = userCache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.user;
  if (hit) userCache.delete(key);

  const user = await User.findById(userId).select('-password');
  if (user) {
    trimUserCache();
    userCache.set(key, { user, expiresAt: Date.now() + USER_CACHE_MS });
  }
  return user;
}

/**
 * Create the persistent UserSession row for a fresh login/register.
 * This is the authoritative session record — the JWT only carries a pointer
 * (sessionId) to it, so logout/EOD/inactivity can actually revoke access
 * instead of just writing an audit-log row.
 */
async function createUserSession({ user, req }) {
  let deviceType = 'unknown';
  let browser = null;
  let operatingSystem = null;
  const userAgent = req.headers['user-agent'] || null;
  if (userAgent) {
    try {
      const parsed = new UAParser(userAgent).getResult();
      deviceType = parsed.device?.type || 'desktop';
      browser = parsed.browser?.name || null;
      operatingSystem = parsed.os?.name || null;
    } catch {
      // Malformed UA string — keep the defaults, never block login on this.
    }
  }

  return UserSession.create({
    userId: user._id,
    sessionId: crypto.randomUUID(),
    role: user.role,
    deviceType,
    browser,
    operatingSystem,
    userAgent,
    ipAddress: getClientIp(req),
    branchId: user.branchId || req.branchId || null,
  });
}

const protect = asyncHandler(async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) throw new ApiError(401, 'Not authorized, no token');

  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  const now = new Date();

  const session = await UserSession.findOneAndUpdate(
    { sessionId: decoded.sessionId, status: 'active' },
    // A real request proves the session is still alive — clear any pending
    // beacon disconnect suspicion so a refresh/bfcache round trip never gets
    // mistaken for a closed tab.
    { $set: { lastActivityAt: now, disconnectSignalAt: null } },
    { new: true }
  ).lean();
  if (!session) throw new ApiError(401, 'Session expired or logged out. Please sign in again.');

  const user = await loadAuthUser(decoded.id);
  if (!user || user.status === 'disabled') {
    UserSession.updateOne(
      { sessionId: decoded.sessionId, status: 'active' },
      { $set: { status: 'revoked', logoutReason: 'revoked', logoutAt: now } }
    ).catch(() => {});
    throw new ApiError(401, 'User not found or disabled');
  }

  if (SESSION_WINDOW_ROLES.includes(user.role) && isPastForcedLogoutTime(now)) {
    const cutoff = getForcedLogoutCutoff(now);
    if (session.loginAt < cutoff) {
      await UserSession.updateMany(
        { userId: user._id, status: 'active', loginAt: { $lt: cutoff } },
        { $set: { status: 'eod_expired', logoutReason: 'eod', logoutAt: cutoff } }
      );
      throw new ApiError(401, `Work day ended at ${formatClockLabel(EOD_HOUR, EOD_MINUTE)}. Please sign in again.`);
    }
  }

  // Roles that have no business access yet (Cold Calling) are fenced to an explicit allow-list.
  assertRoleMayCall(user.role, req.originalUrl);

  req.sessionId = decoded.sessionId;

  const branchIdFromHeader = req.headers['x-branch-id'];
  const branchIdFromQuery = typeof req.query?.branchId === 'string' ? req.query.branchId.trim() : '';
  const requestedBranchId = branchIdFromQuery || branchIdFromHeader || null;
  const userBranchId = user.branchId?.toString?.();
  // Org-wide roles — do not block on branch header/query mismatch
  const isOrgWideRole =
    user.role === 'admin' || user.role === 'hr_admin' || user.role === 'lead_provider';
  if (!isOrgWideRole && requestedBranchId && requestedBranchId !== userBranchId) {
    throw new ApiError(403, 'Access denied for selected branch');
  }

  req.user = user;
  req.permissions = await resolveUserPermissions(user);
  req.branchId = isOrgWideRole
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
  const orgWide = obj.role === 'admin' || obj.role === 'lead_provider';
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
    allowedBranchIds: orgWide ? [] : (obj.branchId ? [obj.branchId] : []),
    teamId: obj.teamId,
    permissions: perms,
    dashboardPath: ROLE_DASHBOARD_PATHS[obj.role] || '/',
    executiveName: obj.role === 'sales_executive' ? obj.name : undefined,
    teamLeaderName: obj.role === 'team_leader' ? obj.name : undefined,
  };
}

const RESTRICTED_SESSION_ROLES = ['admin', 'sales_manager'];

const generateToken = (id, role, sessionId) => {
  const restricted = RESTRICTED_SESSION_ROLES.includes(role);
  const expiresIn = restricted
    ? process.env.JWT_EXPIRES_IN_RESTRICTED || '30m'
    : process.env.JWT_EXPIRES_IN || '30d';
  return jwt.sign({ id, sessionId }, process.env.JWT_SECRET, { expiresIn });
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
  createUserSession,
};
