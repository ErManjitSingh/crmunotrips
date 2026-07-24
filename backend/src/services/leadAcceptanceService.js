const Lead = require('../models/Lead');
const User = require('../models/User');
const ApiError = require('../utils/apiError');
const { LEAD_ACCEPT_MINUTES } = require('../constants/salesSop');
const { computeFirstContactDeadline } = require('./salesSopService');
const { logLeadActivity } = require('./leadActivityService');
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
    throw new ApiError(409, 'Accept window expired — lead returned to pool');
  }

  if (lead.assignmentAcceptBy && new Date(lead.assignmentAcceptBy).getTime() < Date.now()) {
    await releaseExpiredLead(lead);
    throw new ApiError(409, 'Accept window expired — lead returned to pool');
  }

  lead.assignmentAcceptance = 'accepted';
  lead.acceptedAt = new Date();
  lead.acceptanceMissedBy = null;
  lead.acceptanceMissedName = '';
  lead.acceptanceMissedAt = null;
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

/**
 * Accept SLA missed → return lead to unassigned pool (vapas) with "not accepted" marker.
 */
async function releaseExpiredLead(lead) {
  const previousId = lead.assignedTo;
  let previousName = '';
  if (previousId) {
    const prev = await User.findById(previousId).select('name').lean();
    previousName = prev?.name || '';
  }

  const prevIds = Array.isArray(lead.assignmentHistoryIds) ? [...lead.assignmentHistoryIds] : [];
  if (previousId) prevIds.push(previousId);
  lead.assignmentHistoryIds = prevIds.slice(-20);

  lead.assignmentAcceptance = 'expired';
  lead.assignmentAcceptBy = null;
  lead.acceptedAt = null;
  lead.acceptanceMissedBy = previousId || null;
  lead.acceptanceMissedName = previousName;
  lead.acceptanceMissedAt = new Date();
  lead.assignedTo = null;
  lead.assigneeRole = null;
  lead.assignedAt = null;
  lead.firstContactDeadline = null;

  await lead.save();
  if (previousId) await invalidateExecutiveLeadIdsCache(previousId, lead.branchId);

  await logLeadActivity({
    leadId: lead._id,
    branchId: lead.branchId,
    type: 'lead_accept_expired',
    description: previousName
      ? `Accept SLA missed (${LEAD_ACCEPT_MINUTES} min) — ${previousName} did not accept; lead returned to pool`
      : `Accept SLA missed (${LEAD_ACCEPT_MINUTES} min) — lead returned to pool`,
    actor: { name: 'System' },
    meta: { previousAssigneeId: previousId, previousName },
  });

  return { lead, released: true, previousId, previousName };
}

/** @deprecated use releaseExpiredLead — kept for scheduler compatibility */
async function reassignExpiredLead(lead) {
  return releaseExpiredLead(lead);
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

  let released = 0;
  for (const lead of overdue) {
    await releaseExpiredLead(lead);
    released += 1;
  }
  return { checked: overdue.length, reassigned: released, released };
}

module.exports = {
  LEAD_ACCEPT_MINUTES,
  acceptAssignedLead,
  processExpiredAcceptances,
  releaseExpiredLead,
  reassignExpiredLead,
};
