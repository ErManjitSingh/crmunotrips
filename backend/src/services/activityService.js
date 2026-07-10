const ActivityLog = require('../models/ActivityLog');

const ACTIVITY_LOG_RETENTION_MS = 24 * 60 * 60 * 1000;

async function purgeOldActivityLogs() {
  const cutoff = new Date(Date.now() - ACTIVITY_LOG_RETENTION_MS);
  await ActivityLog.deleteMany({ createdAt: { $lt: cutoff } });
}

async function logActivity({ type, user, userId, action, target, ip, meta, branchId }) {
  return ActivityLog.create({
    type,
    user: user || 'System',
    userId,
    branchId: branchId || meta?.branchId || null,
    action,
    target: target || '—',
    ip: ip || '0.0.0.0',
    meta,
  });
}

function getClientIp(req) {
  return req?.ip || req?.headers?.['x-forwarded-for']?.split(',')[0] || '0.0.0.0';
}

module.exports = { logActivity, getClientIp, purgeOldActivityLogs, ACTIVITY_LOG_RETENTION_MS };
