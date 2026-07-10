const { resolveDataKeys } = require('../services/dataSyncService');
const { invalidate: invalidateDashboardCache, cacheKey, navCountsKey } = require('../services/dashboardCacheService');
const { invalidateMailboxCache } = require('../services/emailMailboxCache');
const { invalidateExecutiveLeadIdsCache } = require('../services/executiveScopeService');

let invalidateTimer = null;
const pendingUserInvalidations = new Map();

function scheduleUserCacheInvalidation(userId, role, branchId) {
  if (!userId || !role) return;
  const key = `${role}:${userId}:${branchId || 'all'}`;
  pendingUserInvalidations.set(key, { userId, role, branchId });
  if (invalidateTimer) return;
  invalidateTimer = setTimeout(() => {
    invalidateTimer = null;
    const batch = [...pendingUserInvalidations.values()];
    pendingUserInvalidations.clear();
    batch.forEach(({ userId: uid, role: r, branchId: bid }) => {
      invalidateDashboardCache(cacheKey(r, `${uid}:${bid || 'all'}`));
      invalidateDashboardCache(navCountsKey(r, uid, bid));
      if (r === 'sales_executive') {
        invalidateExecutiveLeadIdsCache(uid, bid);
      }
    });
  }, 400);
}

/** After successful mutations, invalidate only the acting user's cached dashboard/nav data. */
function dataSyncMiddleware(req, res, next) {
  res.on('finish', () => {
    if (res.statusCode < 200 || res.statusCode >= 300) return;
    const keys = resolveDataKeys(req);
    if (!keys?.length) return;

    if (keys.some((k) => ['leads', 'followups', 'quotations', 'dashboard', 'payments'].includes(k))) {
      scheduleUserCacheInvalidation(req.user?._id, req.user?.role, req.branchId);
    }

    if (keys.includes('emails')) {
      invalidateMailboxCache();
    }
  });
  next();
}

module.exports = dataSyncMiddleware;
