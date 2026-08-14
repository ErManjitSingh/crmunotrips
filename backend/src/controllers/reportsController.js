const asyncHandler = require('../utils/asyncHandler');
const { buildReportsAnalytics } = require('../services/dashboardService');

const getAnalytics = asyncHandler(async (req, res) => {
  const dateFrom = typeof req.query.dateFrom === 'string' ? req.query.dateFrom : '';
  const dateTo = typeof req.query.dateTo === 'string' ? req.query.dateTo : '';
  const analytics = await buildReportsAnalytics({
    branchId: req.branchId,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });
  res.json(analytics);
});

module.exports = { getAnalytics };
