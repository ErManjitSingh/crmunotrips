const Lead = require('../models/Lead');
const User = require('../models/User');
const ApiError = require('../utils/apiError');
const { LEAD_ACCEPT_MINUTES } = require('../constants/salesSop');
const { computeFirstContactDeadline } = require('./salesSopService');
const {
  filterEligibleExecutives,
  pickExecutive,
} = require('./assignmentCoreService');
const { stampPendingAcceptance } = require('./leadExecutiveStallService');
const { logLeadActivity } = require('./leadActivityService');
const { notifyLeadAssigned, notifyLeadReassigned } = require('./notificationService');
const { invalidateExecutiveLeadIdsCache } = require('./executiveScopeService');

async function acceptAssignedLead({ leadId, executiveId, branchId }) {
  const lead = await Lead.findOne({
    _id: leadId,
    assignedTo: executiveId,
    ...(branchId ? { branchId } : {}),
    isDeleted: { $ne: true },
  });
  if (!lead) throw new ApiError(404, 'Lead not found or not assigned to you');

  if (lead.assignmentAcceptance === 'accepted') {
    return lead;
  }

  if (lead.assignmentAcceptance === 'expired') {
    throw new ApiError(409, 'Accept window expired — lead was reassigned');
  }

  if (lead.assignmentAcceptBy && new Date(lead.assignmentAcceptBy).getTime() < Date.now()) {
    throw new ApiError(409, 'Accept window expired — lead will be reassigned');
  }

  lead.assignmentAcceptance = 'accepted';
  lead.acceptedAt = new Date();
  if (!lead.firstContactDeadline) {
    lead.firstContactDeadline = computeFirstContactDeadline(lead);
  }
  await lead.save();

  await logLeadActivity({
    leadId: lead._id,
    branchId: lead.branchId,
    type: 'lead_accepted',
    description: `Lead accepted within ${LEAD_ACCEPT_MINUTES}-minute SLA`,
    actor: { _id: executiveId },
    meta: { acceptedAt: lead.acceptedAt },
  });

  return lead;
}

async function findReassignTarget(lead, excludeUserId) {
  const branchId = lead.branchId || null;
  const filter = {
    role: 'sales_executive',
    status: 'active',
    ...(branchId ? { branchId } : {}),
    ...(excludeUserId ? { _id: { $ne: excludeUserId } } : {}),
  };
  if (lead.teamId) filter.teamId = lead.teamId;

  let executives = await User.find(filter).select('name email role teamId').lean();
  if (!executives.length && lead.teamId) {
    executives = await User.find({
      role: 'sales_executive',
      status: 'active',
      ...(branchId ? { branchId } : {}),
      ...(excludeUserId ? { _id: { $ne: excludeUserId } } : {}),
    })
      .select('name email role teamId')
      .lean();
  }

  const eligible = await filterEligibleExecutives(executives, branchId);
  const pool = eligible.length ? eligible : executives;
  if (!pool.length) return null;

  const picked = await pickExecutive(pool, {
    branchId,
    poolKey: 'accept_timeout_reassign',
    destinationId: lead.destination || 'any',
  });
  return picked?.executive || null;
}

async function reassignExpiredLead(lead) {
  const previousId = lead.assignedTo;
  const next = await findReassignTarget(lead, previousId);
  if (!next) {
    lead.assignmentAcceptance = 'expired';
    await lead.save();
    await logLeadActivity({
      leadId: lead._id,
      branchId: lead.branchId,
      type: 'lead_accept_expired',
      description: `Accept SLA missed (${LEAD_ACCEPT_MINUTES} min) — no alternate executive available`,
      actor: { name: 'System' },
      meta: { previousAssigneeId: previousId },
    });
    return { lead, reassigned: false };
  }

  const prevIds = Array.isArray(lead.assignmentHistoryIds) ? [...lead.assignmentHistoryIds] : [];
  if (previousId) prevIds.push(previousId);
  lead.assignmentHistoryIds = prevIds.slice(-20);

  stampPendingAcceptance(lead, lead);
  lead.assignedTo = next._id;
  lead.assigneeRole = 'sales_executive';
  if (next.teamId) lead.teamId = next.teamId;

  await lead.save();
  if (previousId) await invalidateExecutiveLeadIdsCache(previousId, lead.branchId);
  await invalidateExecutiveLeadIdsCache(next._id, lead.branchId);

  await logLeadActivity({
    leadId: lead._id,
    branchId: lead.branchId,
    type: 'lead_auto_reassigned',
    description: `Auto-reassigned after ${LEAD_ACCEPT_MINUTES} min no-accept → ${next.name}`,
    actor: { name: 'System' },
    meta: { from: previousId, to: next._id },
  });

  await notifyLeadAssigned({
    assigneeId: next._id,
    assigneeName: next.name,
    leadIds: [lead._id],
    leadNames: [lead.name],
    assignedBy: 'System (accept timeout)',
  });
  try {
    await notifyLeadReassigned({
      lead,
      actor: { name: 'System' },
      assigneeId: next._id,
      assigneeName: next.name,
    });
  } catch {
    /* optional */
  }

  return { lead, reassigned: true, to: next };
}

async function processExpiredAcceptances() {
  const now = new Date();
  const overdue = await Lead.find({
    isDeleted: { $ne: true },
    assignmentAcceptance: 'pending',
    assignmentAcceptBy: { $lte: now },
    assignedTo: { $ne: null },
    status: { $nin: ['lost', 'converted', 'booked_from_another_company'] },
  })
    .sort({ assignmentAcceptBy: 1 })
    .limit(40);

  let reassigned = 0;
  for (const lead of overdue) {
    const result = await reassignExpiredLead(lead);
    if (result.reassigned) reassigned += 1;
  }
  return { checked: overdue.length, reassigned };
}

module.exports = {
  LEAD_ACCEPT_MINUTES,
  acceptAssignedLead,
  processExpiredAcceptances,
  reassignExpiredLead,
};
