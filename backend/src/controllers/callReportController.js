const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const User = require('../models/User');
const {
  getExecutiveTimeline,
  getExecutiveSummary,
  getTeamOverview,
  getAnalytics,
  getHourlyCallDetail,
  resolveCallerGroup,
} = require('../services/callReportService');
const { resolveScopedExecutiveId } = require('../utils/callReportScope');

const getTimeline = asyncHandler(async (req, res) => {
  const { dateFrom, dateTo, page, limit } = req.query;
  const executiveId = resolveScopedExecutiveId(req, req.query.executiveId);
  if (!executiveId) throw new ApiError(400, 'executiveId is required');
  const result = await getExecutiveTimeline({
    userId: executiveId,
    branchId: req.branchId,
    dateFrom,
    dateTo,
    page,
    limit,
  });
  res.json(result);
});

const getSummary = asyncHandler(async (req, res) => {
  const { dateFrom, dateTo } = req.query;
  const executiveId = resolveScopedExecutiveId(req, req.query.executiveId);
  if (!executiveId) throw new ApiError(400, 'executiveId is required');
  const summary = await getExecutiveSummary({
    userId: executiveId,
    branchId: req.branchId,
    dateFrom,
    dateTo,
  });
  res.json(summary);
});

/** `?team=cold_calling` switches every team-wide view to Cold Calling agents; default is Sales Executives. */
const TEAM_ROLES = { sales: 'sales_executive', cold_calling: 'cold_calling' };

function findActiveTeamMembers(req) {
  return User.find({
    role: TEAM_ROLES[resolveCallerGroup(req.query.team)],
    status: 'active',
    ...(req.branchId ? { branchId: req.branchId } : {}),
  })
    .select('name email')
    .sort({ name: 1 })
    .lean();
}

const getTeamOverviewHandler = asyncHandler(async (req, res) => {
  const { dateFrom, dateTo } = req.query;
  const executives = await findActiveTeamMembers(req);
  const rows = await getTeamOverview(executives, { branchId: req.branchId, dateFrom, dateTo });
  res.json(rows);
});

/** Lightweight roster for the Call Report executive picker (Cold Calling team has no other roster endpoint). */
const getTeamMembersHandler = asyncHandler(async (req, res) => {
  res.json(await findActiveTeamMembers(req));
});

const getAnalyticsHandler = asyncHandler(async (req, res) => {
  const { dateFrom, dateTo } = req.query;
  const executiveId = resolveScopedExecutiveId(req, req.query.executiveId);
  const analytics = await getAnalytics({
    userId: executiveId || undefined,
    branchId: req.branchId,
    team: req.query.team,
    dateFrom,
    dateTo,
  });
  res.json(analytics);
});

const getHourDetail = asyncHandler(async (req, res) => {
  const {
    dateFrom, dateTo, hour, outcome, durationGt, sortBy, sortDir, search, page, limit,
    includeGuestBreakdown,
  } = req.query;
  const executiveId = resolveScopedExecutiveId(req, req.query.executiveId);

  let hourNum;
  if (hour !== undefined && hour !== '') {
    hourNum = Number(hour);
    if (!Number.isInteger(hourNum) || hourNum < 0 || hourNum > 23) {
      throw new ApiError(400, 'hour must be an integer between 0 and 23');
    }
  }

  const result = await getHourlyCallDetail({
    userId: executiveId && executiveId !== 'all' ? executiveId : undefined,
    branchId: req.branchId,
    team: req.query.team,
    dateFrom,
    dateTo,
    hour: hourNum,
    outcome,
    durationGt: durationGt !== undefined && durationGt !== '' ? Number(durationGt) : undefined,
    sortBy,
    sortDir,
    search,
    page,
    limit,
    includeGuestBreakdown: includeGuestBreakdown === 'true' || includeGuestBreakdown === true,
  });
  res.json(result);
});

module.exports = { getTimeline, getSummary, getTeamOverviewHandler, getTeamMembersHandler, getAnalyticsHandler, getHourDetail };
