const Lead = require('../models/Lead');
const User = require('../models/User');
const Team = require('../models/Team');
const ApiError = require('../utils/apiError');
const { ROLE_LABELS } = require('../config/roles');
const { getExecutiveIdsForLeader, getLeaderLeadScopeFilter } = require('./teamScopeService');

const ASSIGNABLE_ROLES = ['sales_manager', 'team_leader', 'sales_executive'];

const { stampPendingAcceptance } = require('./leadExecutiveStallService');

function buildAssignmentPatch(assigneeRole, assignee, leadLike = {}) {
  const patch = { assigneeRole };

  if (assigneeRole === 'sales_manager') {
    patch.assignedManager = assignee._id;
    patch.assignedTeamLeader = null;
    patch.assignedTo = assignee._id;
    patch.assignmentAcceptance = 'not_required';
    patch.assignmentAcceptBy = null;
  } else if (assigneeRole === 'team_leader') {
    patch.assignedTeamLeader = assignee._id;
    patch.assignedTo = assignee._id;
    patch.assigneeRole = 'team_leader';
    patch.assignmentAcceptance = 'not_required';
    patch.assignmentAcceptBy = null;
  } else if (assigneeRole === 'sales_executive') {
    patch.assignedTo = assignee._id;
    patch.assigneeRole = 'sales_executive';
    stampPendingAcceptance(patch, leadLike);
  } else {
    throw new ApiError(400, 'Invalid assignee role');
  }

  return patch;
}

async function resolveAssignee(assigneeId, assigneeRole, branchId) {
  const assignee = await User.findOne({
    _id: assigneeId,
    status: 'active',
    role: assigneeRole,
    ...(branchId ? { branchId } : {}),
  }).select('name email role');

  if (!assignee) throw new ApiError(404, 'Assignee not found or inactive');
  return assignee;
}

async function assertCanAssignLeads(req, { leadIds, assigneeRole, assigneeId }) {
  if (!ASSIGNABLE_ROLES.includes(assigneeRole)) {
    throw new ApiError(400, 'Invalid assignee role');
  }

  const branchId = req.branchId || req.user.branchId || null;
  const assignee = await resolveAssignee(assigneeId, assigneeRole, branchId);

  if (req.user.role === 'admin' || req.user.role === 'lead_provider') {
    return { assignee, branchId };
  }

  if (req.user.role === 'sales_manager') {
    if (assignee.role !== assigneeRole) {
      throw new ApiError(400, 'Assignee role does not match selected role');
    }
    const leadFilter = { _id: { $in: leadIds }, ...(branchId ? { branchId } : {}) };
    const count = await Lead.countDocuments(leadFilter);
    if (count !== leadIds.length) throw new ApiError(404, 'One or more leads were not found');
    return { assignee, branchId };
  }

  if (req.user.role === 'team_leader') {
    if (assigneeRole !== 'sales_executive') {
      throw new ApiError(403, 'Team leaders can assign leads only to sales executives');
    }
    const execIds = await getExecutiveIdsForLeader(req.user._id);
    if (!execIds.some((id) => id === String(assigneeId))) {
      throw new ApiError(403, 'Executive is not in your team');
    }
    const scope = await getLeaderLeadScopeFilter(req.user._id);
    const count = await Lead.countDocuments({
      _id: { $in: leadIds },
      ...scope,
      ...(branchId ? { branchId } : {}),
    });
    if (count !== leadIds.length) {
      throw new ApiError(403, 'One or more leads are outside your team scope');
    }
    const team = await Team.findOne({ teamLeader: req.user._id }).select('_id');
    return { assignee, branchId, teamId: team?._id };
  }

  throw new ApiError(403, 'You are not allowed to assign leads');
}

async function getAssigneesForUser(req) {
  const branchId = req.branchId || req.user.branchId || null;
  const branchFilter = branchId ? { branchId } : {};

  const mapUser = (u) => ({
    _id: u._id,
    name: u.name,
    email: u.email,
    role: u.role,
    roleName: ROLE_LABELS[u.role] || u.role,
  });

  if (req.user.role === 'team_leader') {
    const execIds = await getExecutiveIdsForLeader(req.user._id);
    if (!execIds.length) {
      return { salesManagers: [], teamLeaders: [], salesExecutives: [] };
    }
    const executives = await User.find({
      _id: { $in: execIds },
      role: 'sales_executive',
      status: 'active',
      ...branchFilter,
    })
      .select('name email role')
      .lean();
    return {
      salesManagers: [],
      teamLeaders: [],
      salesExecutives: executives.map(mapUser),
    };
  }

  const users = await User.find({
    status: 'active',
    role: { $in: ASSIGNABLE_ROLES },
    ...branchFilter,
  })
    .select('name email role')
    .lean();

  if (req.user.role === 'sales_manager') {
    return {
      salesManagers: users.filter((u) => u.role === 'sales_manager').map(mapUser),
      teamLeaders: users.filter((u) => u.role === 'team_leader').map(mapUser),
      salesExecutives: users.filter((u) => u.role === 'sales_executive').map(mapUser),
    };
  }

  return {
    salesManagers: users.filter((u) => u.role === 'sales_manager').map(mapUser),
    teamLeaders: users.filter((u) => u.role === 'team_leader').map(mapUser),
    salesExecutives: users.filter((u) => u.role === 'sales_executive').map(mapUser),
  };
}

module.exports = {
  ASSIGNABLE_ROLES,
  buildAssignmentPatch,
  assertCanAssignLeads,
  getAssigneesForUser,
};
