const asyncHandler = require('../utils/asyncHandler');
const { buildAdminDashboard } = require('../services/dashboardService');
const { getOrSetFresh, cacheKey } = require('../services/dashboardCacheService');

const getStats = asyncHandler(async (req, res) => {
  const dateFrom = typeof req.query.dateFrom === 'string' ? req.query.dateFrom : '';
  const dateTo = typeof req.query.dateTo === 'string' ? req.query.dateTo : '';
  const source = typeof req.query.source === 'string' ? req.query.source : '';
  const filterKey = `${dateFrom || 'default'}:${dateTo || 'default'}:${source || 'all'}`;

  const stats = await getOrSetFresh(
    req,
    cacheKey('admin', `dashboard:${req.branchId || 'all'}:${filterKey}`),
    () =>
      buildAdminDashboard({
        branchId: req.branchId,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        source: source || undefined,
      }),
    60 * 1000
  );
  res.json(stats);
});

module.exports = { getStats };
