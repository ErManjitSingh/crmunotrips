const FollowUp = require('../models/FollowUp');
const User = require('../models/User');
const { getFollowUpSummary } = require('../repositories/roleScopedRepository');
const { buildFollowUpTabFilter, startOfDay } = require('../utils/queryHelpers');
const { withBranch } = require('../utils/branchScope');

async function getAdminFollowUpSummary(branchId = null) {
  // "Today's Follow-ups" must match the Dashboard Action Required "Follow-ups Due Today"
  // population (pending-only), per the Phase 2 consistency requirement.
  return getFollowUpSummary({}, { branchId, dueTodayOnly: true });
}

async function getExecutiveFollowUpSummary(userId, leadIds) {
  return getFollowUpSummary({
    $or: [{ assignedTo: userId }, { lead: { $in: leadIds } }],
  });
}

async function getMissedFollowUpsPreview(baseFilter, limit = 8) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  return FollowUp.find({
    ...baseFilter,
    ...buildFollowUpTabFilter('missed'),
  })
    .populate('lead', 'name phone destination')
    .populate('assignedTo', 'name')
    // Newest (most recently overdue) missed follow-up first — same fix as the main missed list.
    .sort({ scheduledAt: -1 })
    .limit(limit)
    .lean();
}

async function getTeamFollowUpReport(branchId = null) {
  const todayStart = startOfDay();
  const todayEnd = new Date(todayStart);
  todayEnd.setHours(23, 59, 59, 999);

  const rows = await FollowUp.aggregate([
    { $match: withBranch({}, branchId) },
    {
      $group: {
        _id: '$assignedTo',
        total: { $sum: 1 },
        today: {
          $sum: {
            $cond: [
              { $and: [{ $gte: ['$scheduledAt', todayStart] }, { $lte: ['$scheduledAt', todayEnd] }] },
              1,
              0,
            ],
          },
        },
        missed: {
          $sum: {
            $cond: [
              {
                $or: [
                  { $eq: ['$status', 'missed'] },
                  { $and: [{ $eq: ['$status', 'pending'] }, { $lt: ['$scheduledAt', todayStart] }] },
                ],
              },
              1,
              0,
            ],
          },
        },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        warm: { $sum: { $cond: [{ $eq: ['$category', 'warm'] }, 1, 0] } },
        converted: { $sum: { $cond: [{ $eq: ['$category', 'converted'] }, 1, 0] } },
      },
    },
    { $sort: { missed: -1, today: -1 } },
  ]);

  const userIds = rows.map((r) => r._id).filter(Boolean);
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } }).select('name').lean()
    : [];
  const userMap = Object.fromEntries(users.map((u) => [u._id.toString(), u.name]));

  return rows.map((r) => ({
    executiveId: r._id,
    executiveName: r._id ? userMap[r._id.toString()] || 'Unknown' : 'Unassigned',
    total: r.total,
    today: r.today,
    missed: r.missed,
    completed: r.completed,
    warm: r.warm,
    converted: r.converted,
  }));
}

module.exports = {
  getAdminFollowUpSummary,
  getExecutiveFollowUpSummary,
  getMissedFollowUpsPreview,
  getTeamFollowUpReport,
};
