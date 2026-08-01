const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const {
  setMonthlyTarget,
  listTargetsForManager,
  listTargetsForLeader,
  currentPeriod,
  getMonthlyTargets,
} = require('../services/salesTargetService');

const listTargets = asyncHandler(async (req, res) => {
  const period = {
    year: Number(req.query.year) || currentPeriod().year,
    month: Number(req.query.month) || currentPeriod().month,
  };

  if (req.user.role === 'sales_manager' || req.user.role === 'admin' || req.user.role === 'lead_provider') {
    return res.json(await listTargetsForManager(req, period));
  }
  if (req.user.role === 'team_leader') {
    return res.json(await listTargetsForLeader(req, period));
  }
  if (req.user.role === 'sales_executive') {
    const targets = await getMonthlyTargets(req.user._id, period);
    return res.json([
      {
        userId: req.user._id,
        name: req.user.name,
        role: req.user.role,
        ...targets,
      },
    ]);
  }
  throw new ApiError(403, 'Not allowed');
});

const upsertTarget = asyncHandler(async (req, res) => {
  if (!['admin', 'sales_manager', 'team_leader', 'lead_provider'].includes(req.user.role)) {
    throw new ApiError(403, 'You do not have permission to set targets');
  }

  const doc = await setMonthlyTarget(req, {
    userId: req.body.userId,
    revenueTarget: req.body.revenueTarget,
    packageTarget: req.body.packageTarget,
    totalSalesTarget: req.body.totalSalesTarget,
    profitTarget: req.body.profitTarget,
    periodType: req.body.periodType,
    workingDays: req.body.workingDays,
    year: req.body.year,
    month: req.body.month,
    notes: req.body.notes,
  });

  res.json(doc);
});

module.exports = { listTargets, upsertTarget };
