const Lead = require('../models/Lead');
const Attendance = require('../models/Attendance');
const Team = require('../models/Team');
const AssignmentRoundRobin = require('../models/AssignmentRoundRobin');
const { startOfCalendarDay } = require('./attendanceService');
const { stampExecutiveAssignment } = require('./leadExecutiveStallService');
const { invalidateExecutiveLeadIdsCache } = require('./executiveScopeService');

const ACTIVE_LEAD_STATUSES = [
  'new',
  'contacted',
  'working_progress',
  'follow_up',
  'quotation_sent',
  'negotiation',
  'reactivated',
];

async function countActiveLeadsForUser(userId, branchId) {
  return Lead.countDocuments({
    assignedTo: userId,
    status: { $in: ACTIVE_LEAD_STATUSES },
    ...(branchId ? { branchId } : {}),
  });
}

async function getPresentUserIds(userIds, branchId) {
  if (!userIds.length) return new Set();
  const dayStart = startOfCalendarDay();
  const rows = await Attendance.find({
    userId: { $in: userIds },
    date: dayStart,
    status: { $in: ['present', 'late'] },
    ...(branchId ? { branchId } : {}),
  })
    .select('userId')
    .lean();

  return new Set(rows.map((r) => String(r.userId)));
}

async function filterEligibleExecutives(executives, branchId) {
  const presentIds = await getPresentUserIds(
    executives.map((e) => e._id),
    branchId
  );
  return executives.filter((e) => presentIds.has(String(e._id)));
}

async function advanceRoundRobin(key, poolLength) {
  const state = await AssignmentRoundRobin.findOneAndUpdate(
    { key },
    { $setOnInsert: { key, lastIndex: -1 } },
    { upsert: true, new: true }
  );
  const nextIndex = (state.lastIndex + 1) % poolLength;
  state.lastIndex = nextIndex;
  await state.save();
  return nextIndex;
}

async function pickExecutive(candidates, { branchId, poolKey, destinationId }) {
  if (!candidates.length) return null;

  const candidateIds = candidates.map((user) => user._id);
  const countRows = await Lead.aggregate([
    {
      $match: {
        assignedTo: { $in: candidateIds },
        status: { $in: ACTIVE_LEAD_STATUSES },
        ...(branchId ? { branchId } : {}),
      },
    },
    { $group: { _id: '$assignedTo', activeLeadCount: { $sum: 1 } } },
  ]);
  const countMap = new Map(countRows.map((row) => [String(row._id), row.activeLeadCount]));

  const enriched = candidates.map((user) => ({
    user,
    activeLeadCount: countMap.get(String(user._id)) || 0,
  }));

  const minCount = Math.min(...enriched.map((c) => c.activeLeadCount));
  const tied = enriched.filter((c) => c.activeLeadCount === minCount);

  if (tied.length === 1) {
    return {
      executive: tied[0].user,
      activeLeadCount: tied[0].activeLeadCount,
      tieBreaker: 'lowest_lead_count',
      candidates: enriched.map((c) => ({
        userId: c.user._id,
        name: c.user.name,
        activeLeadCount: c.activeLeadCount,
      })),
    };
  }

  const sorted = tied.sort((a, b) => String(a.user._id).localeCompare(String(b.user._id)));
  const rrKey = `${branchId}:${poolKey}:${destinationId || 'pool'}`;
  const index = await advanceRoundRobin(rrKey, sorted.length);
  const picked = sorted[index];

  return {
    executive: picked.user,
    activeLeadCount: picked.activeLeadCount,
    tieBreaker: 'round_robin',
    roundRobinIndex: index,
    candidates: enriched.map((c) => ({
      userId: c.user._id,
      name: c.user.name,
      activeLeadCount: c.activeLeadCount,
    })),
  };
}

async function applyExecutiveAssignment(lead, executive) {
  lead.assignedTo = executive._id;
  lead.assigneeRole = 'sales_executive';
  stampExecutiveAssignment(lead);

  if (executive.teamId) {
    const team = await Team.findById(executive.teamId).select('teamLeader').lean();
    if (team?.teamLeader) {
      lead.teamId = executive.teamId;
      lead.assignedTeamLeader = team.teamLeader;
    }
  }

  await lead.save();
  await invalidateExecutiveLeadIdsCache(executive._id, lead.branchId);
}

async function applySalesManagerAssignment(lead, manager) {
  lead.assignedTo = manager._id;
  lead.assignedManager = manager._id;
  lead.assigneeRole = 'sales_manager';
  lead.assignedTeamLeader = null;
  await lead.save();
}

module.exports = {
  ACTIVE_LEAD_STATUSES,
  countActiveLeadsForUser,
  getPresentUserIds,
  filterEligibleExecutives,
  pickExecutive,
  applyExecutiveAssignment,
  applySalesManagerAssignment,
  advanceRoundRobin,
};
