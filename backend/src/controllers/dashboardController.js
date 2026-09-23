const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const { buildAdminDashboard, buildDestinationDetail, buildAllDestinations } = require('../services/dashboardService');
const { getOrSetFresh, cacheKey, DEFAULT_TTL_MS } = require('../services/dashboardCacheService');

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
    DEFAULT_TTL_MS
  );
  res.json(stats);
});

/** Top Destinations chart drill-down — same date-range semantics as getStats. */
const getDestinationDetail = asyncHandler(async (req, res) => {
  const dateFrom = typeof req.query.dateFrom === 'string' ? req.query.dateFrom : '';
  const dateTo = typeof req.query.dateTo === 'string' ? req.query.dateTo : '';
  const source = typeof req.query.source === 'string' ? req.query.source : '';
  const namesParam = typeof req.query.names === 'string' ? req.query.names : '';
  const names = namesParam
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean);
  if (!names.length) {
    throw new ApiError(400, 'names is required');
  }

  const filterKey = `${[...names].sort().join('|')}:${dateFrom || 'default'}:${dateTo || 'default'}:${source || 'all'}`;

  const result = await getOrSetFresh(
    req,
    cacheKey('admin', `dashboard-destination:${req.branchId || 'all'}:${filterKey}`),
    () =>
      buildDestinationDetail({
        branchId: req.branchId,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        source: source || undefined,
        names,
      }),
    DEFAULT_TTL_MS
  );
  res.json(result);
});

/**
 * Complete Top Destinations breakdown ("View all destinations" drill-down) — same
 * period/source/branch semantics as getStats, but no Top-12 cap. Independent cache key from
 * getStats so neither collides with or invalidates the other.
 */
const getAllDestinations = asyncHandler(async (req, res) => {
  const dateFrom = typeof req.query.dateFrom === 'string' ? req.query.dateFrom : '';
  const dateTo = typeof req.query.dateTo === 'string' ? req.query.dateTo : '';
  const source = typeof req.query.source === 'string' ? req.query.source : '';
  const filterKey = `${dateFrom || 'default'}:${dateTo || 'default'}:${source || 'all'}`;

  const result = await getOrSetFresh(
    req,
    cacheKey('admin', `dashboard-destinations-all:${req.branchId || 'all'}:${filterKey}`),
    () =>
      buildAllDestinations({
        branchId: req.branchId,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        source: source || undefined,
      }),
    DEFAULT_TTL_MS
  );
  res.json(result);
});

module.exports = { getStats, getDestinationDetail, getAllDestinations };
