const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const User = require('../models/User');
const Team = require('../models/Team');
const FollowUp = require('../models/FollowUp');
const CallNote = require('../models/CallNote');
const LeadActivity = require('../models/LeadActivity');
const LeadTransferLog = require('../models/LeadTransferLog');
const ColdCallingAssignment = require('../models/ColdCallingAssignment');
const ApiError = require('../utils/apiError');
const { bucketOutcome } = require('../models/CallNote');
const { buildAssignmentPatch } = require('./leadAssignmentService');
const { logLeadActivity } = require('./leadActivityService');
const { logLeadTransfer } = require('./leadTransferService');
const { invalidateExecutiveLeadIdsCache } = require('./executiveScopeService');
const { invalidate: invalidateDashboardCache } = require('./dashboardCacheService');
const { notifyLeadAssigned } = require('./notificationService');
const { logActivity } = require('./activityService');
const { TERMINAL_STATUSES } = require('./leadExecutiveStallService');
const { buildBucketExpression } = require('../utils/listStatusBucketFilter');
const { getConfig } = require('./leadStatusConfigService');
const { parsePagination, paginatedResponse } = require('../utils/pagination');

/**
 * Cold Calling -> Sales Executive reassignment: a REAL transfer of the lead's current Sales ownership.
 *
 * It is the same Lead document before and after (same _id / leadId, same status, calls, follow-ups, notes,
 * timeline, bookings…). Only ownership fields change, through the same `buildAssignmentPatch` the Admin
 * "assign" flow uses, so the new executive gets an ordinary working lead and every existing owner check
 * (`assignedTo: req.user._id`, see leadAccessScope) moves with it. Nothing here widens that check: the
 * previous owner loses all working access automatically and only gets the read-only views below.
 *
 * Audit reuses the existing infrastructure: LeadTransferLog (type 'reassign', meta.source 'cold_calling')
 * is the ownership ledger, and a 'lead_reassigned' LeadActivity puts it on the lead timeline.
 *
 * Race safety without transactions (same approach as Cold Calling assignment): the agent's ACTIVE
 * assignment is claimed atomically first (only one request can close it), then the lead is updated with a
 * compare-and-set on the owner that was read. If the owner changed in between, the claim is rolled back and
 * the request fails with 409 — a stale screen can never overwrite a newer owner.
 */
const SOURCE = 'cold_calling';
const isObjectIdString = (value) => typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);
const idOf = (value) => (value ? String(value._id || value) : null);

async function loadLeadForReassign(leadId) {
  const lead = await Lead.findOne({ _id: leadId, isDeleted: { $ne: true } })
    .select('_id leadId name status statusReason branchId assignedTo originalAssignedTo assignmentHistoryIds travelDate destination leadType isHot source')
    .lean();
  if (!lead) throw new ApiError(404, 'Lead not found');
  return lead;
}

/** Active Sales Executives in the lead's branch. `excludeId` = the current owner (not a valid target). */
function eligibleExecutiveFilter(lead, extra = {}) {
  return {
    role: 'sales_executive',
    status: 'active',
    ...(lead.branchId ? { branchId: lead.branchId } : {}),
    ...extra,
  };
}

async function listReassignOptions({ leadId }) {
  const lead = await loadLeadForReassign(leadId);
  const [executives, owner] = await Promise.all([
    User.find(eligibleExecutiveFilter(lead, lead.assignedTo ? { _id: { $ne: lead.assignedTo } } : {}))
      .select('name email')
      .sort({ name: 1 })
      .lean(),
    lead.assignedTo ? User.findById(lead.assignedTo).select('name').lean() : null,
  ]);
  return {
    lead: { _id: lead._id, leadId: lead.leadId, name: lead.name, status: lead.status },
    currentOwner: owner ? { _id: owner._id, name: owner.name } : null,
    executives: executives.map((ex) => ({ _id: ex._id, name: ex.name, email: ex.email })),
  };
}

/** The executive's team (if any) so Team Leader scope follows the lead to its new owner. */
async function teamFieldsFor(executiveId) {
  const team = await Team.findOne({ members: executiveId }).select('_id teamLeader').lean();
  return { teamId: team?._id || null, assignedTeamLeader: team?.teamLeader || null };
}

async function reassignLeadToExecutive({ actor, assignment, leadId, executiveId, expectedCurrentOwnerId, ip }) {
  if (!isObjectIdString(executiveId)) throw new ApiError(400, 'Select a Sales Executive to reassign this lead to');

  const lead = await loadLeadForReassign(leadId);
  const currentOwnerId = idOf(lead.assignedTo);

  if (expectedCurrentOwnerId !== undefined && expectedCurrentOwnerId !== null && expectedCurrentOwnerId !== '') {
    if (String(expectedCurrentOwnerId) !== String(currentOwnerId)) {
      throw new ApiError(409, 'This lead was reassigned by someone else in the meantime. Refresh and try again.');
    }
  }
  if (TERMINAL_STATUSES.includes(lead.status)) {
    throw new ApiError(409, 'This lead is closed (converted or lost) and cannot be reassigned');
  }

  const target = await User.findOne(eligibleExecutiveFilter(lead, { _id: executiveId })).select('name email role branchId').lean();
  if (!target) throw new ApiError(400, 'The selected user is not an active Sales Executive in this lead’s branch');
  if (currentOwnerId && String(target._id) === currentOwnerId) {
    throw new ApiError(400, `This lead is already owned by ${target.name}`);
  }

  const previousOwner = currentOwnerId ? await User.findById(currentOwnerId).select('name').lean() : null;
  const now = new Date();

  // 1) Claim: only ONE request can close this agent's active assignment.
  const claimed = await ColdCallingAssignment.findOneAndUpdate(
    { _id: assignment._id, coldCallerId: actor._id, status: 'active' },
    {
      $set: {
        status: 'closed',
        closedAt: now,
        closedBy: actor._id,
        closedReason: 'reassigned_to_sales',
        reassignedToId: target._id,
        reassignedToName: target.name,
      },
    },
    { new: true }
  );
  if (!claimed) throw new ApiError(409, 'This lead has already been reassigned');

  // 2) Transfer ownership with a compare-and-set on the owner (and original owner) that was read above.
  const originalOwnerId = lead.originalAssignedTo || lead.assignedTo || null;
  const patch = {
    ...buildAssignmentPatch('sales_executive', target, lead),
    ...(await teamFieldsFor(target._id)),
    ...(!lead.originalAssignedTo && lead.assignedTo ? { originalAssignedTo: lead.assignedTo } : {}),
  };
  const history = [...(lead.assignmentHistoryIds || []), ...(lead.assignedTo ? [lead.assignedTo] : [])].slice(-20);
  const updated = await Lead.findOneAndUpdate(
    {
      _id: lead._id,
      isDeleted: { $ne: true },
      assignedTo: lead.assignedTo || null,
      originalAssignedTo: lead.originalAssignedTo || null,
    },
    { $set: { ...patch, assignmentHistoryIds: history } },
    { new: true }
  )
    .select('_id leadId name status statusReason assignedTo originalAssignedTo branchId')
    .lean();

  if (!updated) {
    // Lost the race: someone changed the owner after we read it. Undo the claim; nothing else was written.
    await ColdCallingAssignment.updateOne(
      { _id: claimed._id, status: 'closed', closedReason: 'reassigned_to_sales', closedBy: actor._id },
      { $set: { status: 'active' }, $unset: { closedAt: 1, closedBy: 1, closedReason: 1, reassignedToId: 1, reassignedToName: 1 } }
    ).catch(() => {});
    throw new ApiError(409, 'This lead was reassigned by someone else in the meantime. Refresh and try again.');
  }

  // 3) Side effects — ownership bookkeeping only; the lead's data is untouched.
  // Pending follow-ups owned by the previous owner move with the lead so the old owner can't keep working it.
  if (currentOwnerId) {
    await FollowUp.updateMany({ lead: lead._id, status: 'pending', assignedTo: currentOwnerId }, { $set: { assignedTo: target._id } });
  }
  await Promise.all([
    currentOwnerId ? invalidateExecutiveLeadIdsCache(currentOwnerId, lead.branchId) : null,
    currentOwnerId ? invalidateExecutiveLeadIdsCache(currentOwnerId, null) : null,
    invalidateExecutiveLeadIdsCache(target._id, lead.branchId),
    invalidateExecutiveLeadIdsCache(target._id, null),
  ]);
  invalidateDashboardCache('sales_executive');

  const originalOwner = originalOwnerId
    ? String(originalOwnerId) === currentOwnerId
      ? previousOwner
      : await User.findById(originalOwnerId).select('name').lean()
    : null;
  const fromName = previousOwner?.name || 'Unassigned';
  const meta = {
    source: SOURCE,
    fromUserId: currentOwnerId,
    fromName,
    toUserId: target._id,
    toName: target.name,
    originalOwnerId: originalOwnerId || null,
    originalOwnerName: originalOwner?.name || null,
    coldCallingAssignmentId: claimed._id,
    reassignedById: actor._id,
    reassignedByName: actor.name,
  };

  await Promise.all([
    logLeadActivity({
      leadId: lead._id,
      branchId: lead.branchId,
      type: 'lead_reassigned',
      title: 'Reassigned from Cold Calling',
      description: `${fromName} → Cold Calling (${actor.name}) → ${target.name}`,
      actor,
      meta,
    }),
    logLeadTransfer({
      leadId: lead._id,
      branchId: lead.branchId,
      type: 'reassign',
      actor,
      fromUserId: currentOwnerId,
      toUserId: target._id,
      note: `Reassigned from Cold Calling by ${actor.name}: ${fromName} → ${target.name}`,
      meta,
    }),
    logActivity({
      type: 'lead_assigned',
      user: actor.name,
      userId: actor._id,
      action: `Reassigned lead ${lead.leadId || lead.name} from ${fromName} to ${target.name} (Cold Calling)`,
      target: target.name,
      ip,
      branchId: lead.branchId || null,
      meta: { leadId: lead._id, ...meta },
    }).catch(() => {}),
  ]);
  notifyLeadAssigned({
    assigneeId: target._id,
    assigneeName: target.name,
    leadIds: [lead._id],
    leadNames: [lead.name],
    assignedBy: actor,
    assigneeRole: 'sales_executive',
  }).catch(() => {});

  return {
    message: `Lead reassigned to ${target.name}.`,
    lead: {
      _id: updated._id,
      leadId: updated.leadId,
      name: updated.name,
      status: updated.status,
      statusReason: updated.statusReason || '',
    },
    originalOwner: originalOwner ? { _id: originalOwner._id, name: originalOwner.name } : null,
    previousOwner: previousOwner ? { _id: previousOwner._id, name: previousOwner.name } : null,
    currentOwner: { _id: target._id, name: target.name },
    reassignedAt: now,
  };
}

/* ------------------------------------------------------------------------------------------------ */
/* Previous owner: read-only views                                                                  */
/* ------------------------------------------------------------------------------------------------ */

/** "This lead has been reassigned to {name}…" — the exact wording every surface uses. */
function reassignedMessage(name) {
  return `This lead has been reassigned to ${name || 'another executive'} and is no longer part of your active leads.`;
}

/**
 * If `executiveId` used to own this lead and it was taken away through Cold Calling reassignment (and they
 * don't own it again now), returns who owns it now. Otherwise null. Used both for the read-only views and to
 * turn the generic "not found" of owner-only routes into the clear reassigned message.
 */
async function findReassignedAway({ executiveId, leadId }) {
  if (!isObjectIdString(String(leadId))) return null;
  const lead = await Lead.findOne({ _id: leadId, isDeleted: { $ne: true } }).select('_id assignedTo branchId').lean();
  if (!lead || idOf(lead.assignedTo) === String(executiveId)) return null;
  const log = await LeadTransferLog.findOne({ leadId: lead._id, fromUserId: executiveId, type: 'reassign', 'meta.source': SOURCE })
    .sort({ createdAt: -1 })
    .lean();
  if (!log) return null;
  const owner = lead.assignedTo ? await User.findById(lead.assignedTo).select('name').lean() : null;
  return { lead, log, currentOwner: owner ? { _id: owner._id, name: owner.name } : null };
}

/** Leads that were transferred away from this executive through Cold Calling and are no longer theirs. */
async function listReassignedAwayLeads({ executiveId, branchId, query = {} }) {
  await getConfig({ includeDisabled: false });
  const { page, limit, skip } = parsePagination(query, { defaultLimit: 25, maxLimit: 100 });
  const me = new mongoose.Types.ObjectId(String(executiveId));
  const leadIds = await LeadTransferLog.distinct('leadId', { fromUserId: me, type: 'reassign', 'meta.source': SOURCE });
  const filter = {
    _id: { $in: leadIds },
    isDeleted: { $ne: true },
    assignedTo: { $ne: me },
    // Aggregate $match does not auto-cast like Model.find() — the branch id must be an ObjectId.
    ...(branchId ? { branchId: new mongoose.Types.ObjectId(String(branchId)) } : {}),
  };
  const [rows, total] = await Promise.all([
    Lead.aggregate([
      { $match: filter },
      { $sort: { updatedAt: -1, _id: -1 } },
      { $skip: skip },
      { $limit: limit },
      { $lookup: { from: 'users', localField: 'assignedTo', foreignField: '_id', as: 'owner' } },
      { $lookup: { from: 'users', localField: 'originalAssignedTo', foreignField: '_id', as: 'original' } },
      {
        $project: {
          leadId: 1, name: 1, destination: 1, travelDate: 1, status: 1, statusReason: 1,
          bucket: { $ifNull: [buildBucketExpression({ status: '$status', statusReason: '$statusReason' }), 'unclassified'] },
          currentOwner: { $arrayElemAt: ['$owner', 0] },
          originalOwner: { $arrayElemAt: ['$original', 0] },
        },
      },
    ]),
    Lead.countDocuments(filter),
  ]);

  // When did the lead leave ME (my latest outgoing Cold Calling transfer) — one query for the page.
  const logs = await LeadTransferLog.aggregate([
    { $match: { leadId: { $in: rows.map((r) => r._id) }, fromUserId: me, type: 'reassign', 'meta.source': SOURCE } },
    { $sort: { createdAt: -1 } },
    { $group: { _id: '$leadId', at: { $first: '$createdAt' }, by: { $first: '$actorName' }, to: { $first: '$meta.toName' } } },
  ]);
  const logByLead = new Map(logs.map((l) => [String(l._id), l]));

  return paginatedResponse(
    rows.map((row) => {
      const log = logByLead.get(String(row._id));
      const ownerName = row.currentOwner?.name || null;
      return {
        _id: row._id,
        leadId: row.leadId,
        name: row.name,
        destination: row.destination || null,
        travelDate: row.travelDate || null,
        status: row.status,
        statusReason: row.statusReason || '',
        bucket: row.bucket,
        originalOwner: row.originalOwner ? { _id: row.originalOwner._id, name: row.originalOwner.name } : null,
        currentOwner: row.currentOwner ? { _id: row.currentOwner._id, name: ownerName } : null,
        reassignedAt: log?.at || null,
        reassignedBy: log?.by || null,
        reassignedToFromMe: log?.to || null,
        message: reassignedMessage(ownerName),
      };
    }),
    { page, limit, total }
  );
}

/**
 * Read-only detail for a previous owner: lead summary (no phone / email — calling is not theirs any more),
 * every call, the timeline and the ownership chain. 404 unless the lead really was reassigned away from them.
 */
async function getReassignedAwayLeadDetail({ executiveId, leadId }) {
  await getConfig({ includeDisabled: false });
  const found = await findReassignedAway({ executiveId, leadId });
  if (!found) throw new ApiError(404, 'Lead not found');

  const [lead, calls, timeline, transfers] = await Promise.all([
    Lead.findById(found.lead._id)
      .select('leadId name destination travelDate status statusReason createdAt originalAssignedTo')
      .populate('originalAssignedTo', 'name')
      .lean(),
    CallNote.find({ leadId: found.lead._id })
      .select('outcome notes duration startedAt endedAt createdAt userId')
      .populate('userId', 'name role')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean(),
    LeadActivity.find({ leadId: found.lead._id }).select('type title description actorName createdAt').sort({ createdAt: -1 }).limit(200).lean(),
    LeadTransferLog.find({ leadId: found.lead._id, type: 'reassign', 'meta.source': SOURCE })
      .select('createdAt actorName meta')
      .sort({ createdAt: 1 })
      .lean(),
  ]);

  const [bucketRow] = await Lead.aggregate([
    { $match: { _id: found.lead._id } },
    { $project: { bucket: { $ifNull: [buildBucketExpression({ status: '$status', statusReason: '$statusReason' }), 'unclassified'] } } },
  ]);

  return {
    readOnly: true,
    message: reassignedMessage(found.currentOwner?.name),
    lead: {
      _id: lead._id,
      leadId: lead.leadId,
      name: lead.name,
      destination: lead.destination || null,
      travelDate: lead.travelDate || null,
      status: lead.status,
      statusReason: lead.statusReason || '',
      bucket: bucketRow?.bucket || 'unclassified',
      createdAt: lead.createdAt,
    },
    originalOwner: lead.originalAssignedTo ? { _id: lead.originalAssignedTo._id, name: lead.originalAssignedTo.name } : null,
    currentOwner: found.currentOwner,
    reassignments: transfers.map((t) => ({
      at: t.createdAt,
      from: t.meta?.fromName || null,
      to: t.meta?.toName || null,
      by: t.meta?.reassignedByName || t.actorName || null,
    })),
    calls: calls.map((c) => ({
      _id: c._id,
      caller: c.userId ? { name: c.userId.name, role: c.userId.role } : null,
      startedAt: c.startedAt || c.createdAt,
      endedAt: c.endedAt || null,
      duration: c.duration || 0,
      outcome: c.outcome,
      bucket: bucketOutcome(c.outcome),
      notes: c.notes || '',
    })),
    timeline: timeline.map((a) => ({ _id: a._id, type: a.type, title: a.title, description: a.description || '', actorName: a.actorName, at: a.createdAt })),
  };
}

module.exports = {
  SOURCE,
  listReassignOptions,
  reassignLeadToExecutive,
  reassignedMessage,
  findReassignedAway,
  listReassignedAwayLeads,
  getReassignedAwayLeadDetail,
};
