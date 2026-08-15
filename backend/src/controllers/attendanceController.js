const asyncHandler = require('../utils/asyncHandler');
const {
  checkIn,
  checkOut,
  getTodayStatus,
  getMyHistory,
  buildTodaySummary,
  buildRangeSummary,
} = require('../services/attendanceService');

const getStatus = asyncHandler(async (req, res) => {
  const status = await getTodayStatus(req.user._id);
  res.json(status);
});

const postCheckIn = asyncHandler(async (req, res) => {
  const { workMode } = req.body;
  const record = await checkIn(req.user._id, workMode);
  res.status(201).json({
    message: 'Office check-in successful',
    record,
  });
});

const postCheckOut = asyncHandler(async (req, res) => {
  const record = await checkOut(req.user._id);
  res.json({
    message: 'Check-out successful',
    record,
  });
});

const getMe = asyncHandler(async (req, res) => {
  const history = await getMyHistory(req.user._id, Number(req.query.limit) || 30);
  res.json({ history });
});

const getToday = asyncHandler(async (req, res) => {
  const data = await buildTodaySummary(req.user, req.branchId);
  res.json(data);
});

const getSummary = asyncHandler(async (req, res) => {
  const { from, to, branchId: queryBranch } = req.query;
  const canPickBranch = req.user.role === 'admin' || req.user.role === 'lead_provider';
  const branchId =
    canPickBranch && typeof queryBranch === 'string' && queryBranch
      ? queryBranch
      : req.branchId;
  const data = await buildRangeSummary(req.user, branchId || null, from, to || from);
  res.json(data);
});

module.exports = {
  getStatus,
  postCheckIn,
  postCheckOut,
  getMe,
  getToday,
  getSummary,
};
