const MonthlySalesTarget = require('../models/MonthlySalesTarget');
const User = require('../models/User');
const ApiError = require('../utils/apiError');
const { getExecutiveIdsForLeader } = require('./teamScopeService');

const DEFAULT_TARGETS = {
  sales_executive: 1500000,
  team_leader: 3500000,
};

function currentPeriod(date = new Date()) {
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function defaultWorkingDays(year, month) {
  const dim = daysInMonth(year, month);
  // Default to weekdays-ish count, capped by days in month
  return Math.min(dim, 26);
}

function defaultRow(role, period = currentPeriod()) {
  const revenueTarget = DEFAULT_TARGETS[role] || DEFAULT_TARGETS.sales_executive;
  return {
    revenueTarget,
    packageTarget: 0,
    totalSalesTarget: revenueTarget,
    profitTarget: 0,
    periodType: 'monthly',
    workingDays: defaultWorkingDays(period.year, period.month),
    isDefault: true,
  };
}

function normalizeAmount(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new ApiError(400, 'Target values must be valid numbers ≥ 0');
  }
  return n;
}

function shapeTargetRow(row, role, period = currentPeriod()) {
  if (!row) return defaultRow(role, period);
  return {
    revenueTarget: row.revenueTarget ?? 0,
    packageTarget: row.packageTarget ?? 0,
    totalSalesTarget: row.totalSalesTarget ?? row.revenueTarget ?? 0,
    profitTarget: row.profitTarget ?? 0,
    periodType: row.periodType === 'daily' ? 'daily' : 'monthly',
    workingDays: Math.min(
      31,
      Math.max(1, Number(row.workingDays) || defaultWorkingDays(period.year, period.month))
    ),
    isDefault: false,
    setByName: row.setByName,
    updatedAt: row.updatedAt,
  };
}

async function getMonthlyTargetDoc(userId, { year, month } = currentPeriod()) {
  return MonthlySalesTarget.findOne({ userId, year, month }).lean();
}

async function getMonthlyTarget(userId, { year, month } = currentPeriod()) {
  const row = await getMonthlyTargetDoc(userId, { year, month });
  if (row) return row.revenueTarget;
  const user = await User.findById(userId).select('role').lean();
  return DEFAULT_TARGETS[user?.role] || DEFAULT_TARGETS.sales_executive;
}

async function getMonthlyTargets(userId, { year, month } = currentPeriod()) {
  const period = { year, month };
  const row = await getMonthlyTargetDoc(userId, period);
  const user = await User.findById(userId).select('role').lean();
  return shapeTargetRow(row, user?.role, period);
}

async function assertCanSetTarget(req, targetUserId) {
  const targetUser = await User.findById(targetUserId).select('role branchId').lean();
  if (!targetUser) throw new ApiError(404, 'User not found');

  if (req.user.role === 'admin' || req.user.role === 'sales_manager') {
    if (!['sales_executive', 'team_leader'].includes(targetUser.role)) {
      throw new ApiError(400, 'Targets can only be set for sales executives and team leaders');
    }
    return targetUser;
  }

  if (req.user.role === 'team_leader') {
    if (targetUser.role !== 'sales_executive') {
      throw new ApiError(403, 'Team leaders can only set targets for sales executives');
    }
    const execIds = await getExecutiveIdsForLeader(req.user._id);
    if (!execIds.includes(String(targetUserId))) {
      throw new ApiError(403, 'This executive is not on your team');
    }
    return targetUser;
  }

  throw new ApiError(403, 'You do not have permission to set sales targets');
}

async function setMonthlyTarget(req, {
  userId,
  revenueTarget,
  packageTarget,
  totalSalesTarget,
  profitTarget,
  periodType,
  workingDays,
  year,
  month,
  notes,
}) {
  const period = year && month ? { year: Number(year), month: Number(month) } : currentPeriod();

  const existing = await getMonthlyTargetDoc(userId, period);
  const target = normalizeAmount(revenueTarget, existing?.revenueTarget ?? 0);
  const packages = normalizeAmount(packageTarget, existing?.packageTarget ?? 0);
  const totalSales = normalizeAmount(
    totalSalesTarget,
    existing?.totalSalesTarget ?? existing?.revenueTarget ?? 0
  );
  const profit = normalizeAmount(profitTarget, existing?.profitTarget ?? 0);
  const type = periodType === 'daily' ? 'daily' : 'monthly';
  const days = Math.min(
    daysInMonth(period.year, period.month),
    Math.max(1, Number(workingDays) || existing?.workingDays || defaultWorkingDays(period.year, period.month))
  );

  if (
    revenueTarget === undefined &&
    packageTarget === undefined &&
    totalSalesTarget === undefined &&
    profitTarget === undefined
  ) {
    throw new ApiError(400, 'At least one target field is required');
  }

  const targetUser = await assertCanSetTarget(req, userId);

  const doc = await MonthlySalesTarget.findOneAndUpdate(
    { userId, year: period.year, month: period.month },
    {
      userId,
      year: period.year,
      month: period.month,
      revenueTarget: target,
      packageTarget: packages,
      totalSalesTarget: totalSales,
      profitTarget: profit,
      periodType: type,
      workingDays: days,
      branchId: targetUser.branchId || req.branchId || null,
      setBy: req.user._id,
      setByName: req.user.name,
      notes: notes?.trim() || '',
    },
    { upsert: true, new: true }
  ).lean();

  return doc;
}

function mapListedUser(u, map, period) {
  const shaped = shapeTargetRow(map[String(u._id)], u.role, period);
  return {
    userId: u._id,
    name: u.name,
    email: u.email,
    role: u.role,
    ...shaped,
  };
}

async function listTargetsForManager(req, { year, month } = currentPeriod()) {
  const period = { year: Number(year), month: Number(month) };
  // Admin + Sales Manager can set targets for any active executive / team leader.
  const users = await User.find({
    role: { $in: ['sales_executive', 'team_leader'] },
    status: 'active',
  })
    .select('name email role')
    .sort({ role: 1, name: 1 })
    .lean();

  const targets = await MonthlySalesTarget.find({
    userId: { $in: users.map((u) => u._id) },
    year: period.year,
    month: period.month,
  }).lean();

  const map = Object.fromEntries(targets.map((t) => [String(t.userId), t]));
  return users.map((u) => mapListedUser(u, map, period));
}

async function listTargetsForLeader(req, { year, month } = currentPeriod()) {
  const period = { year: Number(year), month: Number(month) };
  const execIds = await getExecutiveIdsForLeader(req.user._id);
  const users = await User.find({ _id: { $in: execIds } }).select('name email role').lean();

  const targets = await MonthlySalesTarget.find({
    userId: { $in: execIds },
    year: period.year,
    month: period.month,
  }).lean();

  const map = Object.fromEntries(targets.map((t) => [String(t.userId), t]));
  return users.map((u) => mapListedUser(u, map, period));
}

function buildTargetProgress(revenueAchieved, monthlyTarget) {
  const target = monthlyTarget || DEFAULT_TARGETS.sales_executive;
  return {
    monthlyTarget: target,
    revenueAchieved,
    progress: target ? Math.min(100, Math.round((revenueAchieved / target) * 100)) : 0,
  };
}

module.exports = {
  DEFAULT_TARGETS,
  currentPeriod,
  shapeTargetRow,
  getMonthlyTarget,
  getMonthlyTargetDoc,
  getMonthlyTargets,
  setMonthlyTarget,
  listTargetsForManager,
  listTargetsForLeader,
  buildTargetProgress,
};
