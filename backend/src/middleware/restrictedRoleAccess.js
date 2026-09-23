const ApiError = require('../utils/apiError');

/**
 * Roles that have NO business API access yet: deny-by-default, with only the listed endpoints open.
 *
 * Most read endpoints in this API are guarded only by "is authenticated", so a role that simply has
 * no permissions still reads leads, users, quotations, dashboards… A newly added role must not
 * inherit that, so it is fenced here instead. A role that is not listed is not affected at all.
 *
 * Entries are matched against the path after `/api`, case-insensitively: an exact path, or a prefix
 * ending in `/*`. Deliberately exact for /auth — `/auth/register` (create a user with any role) must
 * never be reachable from a restricted role.
 *
 * When the Cold Calling feature is built, widen its list here — this is the only place to do it.
 */
const RESTRICTED_ROLE_ALLOWED_PATHS = {
  cold_calling: [
    '/auth/me',
    '/auth/logout',
    '/auth/session/heartbeat',
    '/auth/session/beacon',
    '/notifications/*', // the signed-in user's own notifications (polled by the app shell)
    '/lead-status-config', // read-only option labels the app shell loads for every signed-in user
    '/cold-calling/my-leads', // the agent's OWN assignments (identity comes from the session, never a parameter)
    '/cold-calling/leads/*', // per-lead calling; the router itself requires an ACTIVE assignment for the signed-in agent
  ],
};

function apiPathOf(originalUrl = '') {
  return String(originalUrl).split('?')[0].replace(/^\/api(?=\/|$)/i, '').toLowerCase().replace(/\/+$/, '') || '/';
}

/** True when `role` may call `originalUrl` (roles without an entry are unrestricted here). */
function isApiPathAllowedForRole(role, originalUrl) {
  const allowed = RESTRICTED_ROLE_ALLOWED_PATHS[role];
  if (!allowed) return true;
  const path = apiPathOf(originalUrl);
  return allowed.some((entry) =>
    entry.endsWith('/*') ? path === entry.slice(0, -2) || path.startsWith(`${entry.slice(0, -1)}`) : path === entry
  );
}

/** Throws 403 when a restricted role calls an endpoint outside its allow-list. */
function assertRoleMayCall(role, originalUrl) {
  if (!isApiPathAllowedForRole(role, originalUrl)) {
    throw new ApiError(403, 'Your role does not have access to this yet');
  }
}

module.exports = { RESTRICTED_ROLE_ALLOWED_PATHS, isApiPathAllowedForRole, assertRoleMayCall };
