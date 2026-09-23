const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const User = require('../models/User');
const LeadActivity = require('../models/LeadActivity');
const ColdCallingAssignment = require('../models/ColdCallingAssignment');
const ApiError = require('../utils/apiError');
const { getConfig } = require('./leadStatusConfigService');
const { summarizeMyCalls, canCallLead, lifecycleOf } = require('./coldCallingCallService');
const { buildBucketExpression } = require('../utils/listStatusBucketFilter');
const { parsePagination, paginatedResponse } = require('../utils/pagination');

/**
 * Admin: send Cold leads to a Cold Calling agent. Creates ColdCallingAssignment records ONLY —
 * this module never writes to the Lead collection, so Sales ownership (Lead.assignedTo) is untouched.
 *
 * Everything the client says is re-derived here: the lead's owner, branch, deleted flag and current
 * Cold bucket come from the database (the same bucket rule the Executive Lead Status drill-down
 * shows), and the agent's role / status / branch come from the users collection. The client's
 * executiveId is only an "I expect this lead to still belong to X" guard against stale screens.
 *
 * Semantics (deterministic):
 *  - All-or-nothing: if ANY lead fails validation, nothing is assigned and every failure is reported.
 *  - A lead already actively assigned to the SAME agent is a no-op ("already assigned"), not an error,
 *    so a double click or retry is safe.
 *  - A lead already actively assigned to a DIFFERENT agent fails ("Already assigned to X"). Explicit
 *    reassignment between agents is a later phase.
 *  - Races (two Admins, two tabs) are decided by the database's partial unique index, not by the
 *    check above; a losing batch is rolled back.
 */

const MAX_LEADS_PER_REQUEST = 200;
const OBJECT_ID = /^[a-f0-9]{24}$/i;

function toObjectId(value, label) {
  if (typeof value !== 'string' || !OBJECT_ID.test(value.trim())) throw new ApiError(400, `${label} is invalid`);
  return new mongoose.Types.ObjectId(value.trim());
}

function parseAssignRequest(body = {}) {
  const executiveId = toObjectId(body.executiveId, 'executive');
  const coldCallerId = toObjectId(body.coldCallerId, 'Cold Calling agent');
  if (!Array.isArray(body.leadIds) || body.leadIds.length === 0) throw new ApiError(400, 'Select at least one lead');
  if (body.leadIds.length > MAX_LEADS_PER_REQUEST) {
    throw new ApiError(400, `You can assign at most ${MAX_LEADS_PER_REQUEST} leads at a time`);
  }
  const seen = new Set();
  const leadIds = [];
  for (const raw of body.leadIds) {
    const id = toObjectId(raw, 'lead id');
    if (!seen.has(String(id))) {
      seen.add(String(id));
      leadIds.push(id);
    }
  }
  return { executiveId, coldCallerId, leadIds };
}

const failure = (leadId, code, message, extra = {}) => ({ leadId: String(leadId), code, message, ...extra });

/** Active Cold Calling agents (the assignment dropdown). Scoped to the Admin's branch when one is selected. */
async function listColdCallingAgents({ branchId } = {}) {
  return User.find({ role: 'cold_calling', status: 'active', ...(branchId ? { branchId } : {}) })
    .select('name email branchId')
    .sort({ name: 1 })
    .lean();
}

async function assignColdLeads({ actor, branchId = null, body }) {
  const { executiveId, coldCallerId, leadIds } = parseAssignRequest(body);
  await getConfig({ includeDisabled: false });

  // Four bulk reads, whatever the number of leads — no per-lead queries.
  const [executive, coldCaller, leads, existing] = await Promise.all([
    User.findOne({ _id: executiveId, role: 'sales_executive' }).select('name').lean(),
    User.findOne({ _id: coldCallerId, role: 'cold_calling', status: 'active' }).select('name branchId').lean(),
    Lead.aggregate([
      { $match: { _id: { $in: leadIds } } },
      { $addFields: { leadStatusBucket: { $ifNull: [buildBucketExpression(), 'unclassified'] } } },
      { $project: { branchId: 1, assignedTo: 1, isDeleted: 1, statusReason: 1, leadStatusBucket: 1 } },
    ]),
    ColdCallingAssignment.find({ leadId: { $in: leadIds }, status: 'active' })
      .select('leadId coldCallerId coldCallerName')
      .lean(),
  ]);

  if (!executive) throw new ApiError(404, 'Executive not found');
  if (!coldCaller) throw new ApiError(400, 'Cold Calling agent not found, inactive, or not a Cold Calling user');

  const leadById = new Map(leads.map((lead) => [String(lead._id), lead]));
  const existingByLead = new Map(existing.map((row) => [String(row.leadId), row]));

  const failures = [];
  const alreadyAssigned = [];
  const toCreate = [];

  for (const leadId of leadIds) {
    const lead = leadById.get(String(leadId));
    const held = existingByLead.get(String(leadId));

    if (!lead) failures.push(failure(leadId, 'not_found', 'Lead not found'));
    else if (lead.isDeleted) failures.push(failure(leadId, 'deleted', 'Lead has been deleted'));
    else if (branchId && String(lead.branchId) !== String(branchId)) {
      failures.push(failure(leadId, 'wrong_branch', 'Lead is outside the selected branch'));
    } else if (held) {
      if (String(held.coldCallerId) === String(coldCallerId)) alreadyAssigned.push({ leadId: String(leadId), assignmentId: String(held._id) });
      else {
        failures.push(
          failure(leadId, 'already_assigned', `Already assigned to ${held.coldCallerName || 'another Cold Calling agent'}`, {
            coldCallerName: held.coldCallerName || '',
          })
        );
      }
    } else if (String(lead.assignedTo) !== String(executiveId)) {
      failures.push(failure(leadId, 'owner_changed', `No longer owned by ${executive.name}`));
    } else if (lead.leadStatusBucket !== 'cold') {
      failures.push(failure(leadId, 'not_cold', `No longer Cold (now ${lead.leadStatusBucket})`, { currentBucket: lead.leadStatusBucket }));
    } else if (!coldCaller.branchId || String(coldCaller.branchId) !== String(lead.branchId)) {
      failures.push(failure(leadId, 'agent_branch_mismatch', 'The Cold Calling agent belongs to a different branch than this lead'));
    } else {
      toCreate.push(lead);
    }
  }

  if (failures.length) {
    return { ok: false, statusCode: 409, message: 'No leads were assigned. Some leads cannot be assigned.', failures };
  }

  const now = new Date();
  const docs = toCreate.map((lead) => ({
    _id: new mongoose.Types.ObjectId(),
    leadId: lead._id,
    branchId: lead.branchId,
    coldCallerId,
    coldCallerName: coldCaller.name,
    originalSalesOwnerId: lead.assignedTo,
    originalSalesOwnerName: executive.name,
    initialBucket: 'cold',
    initialStatusReason: lead.statusReason || '',
    status: 'active',
    assignedAt: now,
    assignedBy: actor._id,
    assignedByName: actor.name,
  }));

  let created = docs;
  if (docs.length) {
    const ourIds = docs.map((doc) => doc._id);
    try {
      await ColdCallingAssignment.insertMany(docs, { ordered: false });
    } catch (error) {
      // A concurrent request won some leads (the unique index rejected ours). Work out exactly what happened.
      const inserted = await ColdCallingAssignment.find({ _id: { $in: ourIds } }).select('_id leadId').lean();
      const insertedIds = new Set(inserted.map((row) => String(row._id)));
      created = docs.filter((doc) => insertedIds.has(String(doc._id)));
      const lostLeadIds = docs.filter((doc) => !insertedIds.has(String(doc._id))).map((doc) => doc.leadId);

      const winners = lostLeadIds.length
        ? await ColdCallingAssignment.find({ leadId: { $in: lostLeadIds }, status: 'active' }).select('leadId coldCallerId coldCallerName').lean()
        : [];
      const isDuplicateRace = error?.code === 11000 || error?.writeErrors?.length || winners.length;
      const conflicts = winners.filter((row) => String(row.coldCallerId) !== String(coldCallerId));
      const wonLeadIds = new Set(winners.map((row) => String(row.leadId)));
      const unresolved = lostLeadIds.filter((id) => !wonLeadIds.has(String(id)));

      if (!isDuplicateRace || conflicts.length || unresolved.length) {
        // Undo only what THIS request created, so the caller never sees a half-applied batch.
        await ColdCallingAssignment.deleteMany({ _id: { $in: created.map((doc) => doc._id) } });
        if (!isDuplicateRace) throw error;
        return {
          ok: false,
          statusCode: 409,
          message: 'No leads were assigned. Some leads were just assigned to another Cold Calling agent.',
          failures: [
            ...conflicts.map((row) =>
              failure(row.leadId, 'already_assigned', `Already assigned to ${row.coldCallerName || 'another Cold Calling agent'}`, {
                coldCallerName: row.coldCallerName || '',
              })
            ),
            ...unresolved.map((id) => failure(id, 'conflict', 'Changed at the same time. Please try again.')),
          ],
        };
      }
      // Every lost lead was won by the SAME agent (an identical concurrent request): that is "already assigned".
      winners.forEach((row) => alreadyAssigned.push({ leadId: String(row.leadId), assignmentId: String(row._id) }));
    }
  }

  if (created.length) {
    // Audit trail on each lead's own timeline (existing LeadActivity infrastructure). Non-fatal: the
    // assignment record is already the source of truth.
    LeadActivity.insertMany(
      created.map((doc) => ({
        leadId: doc.leadId,
        branchId: doc.branchId,
        type: 'cold_calling_assigned',
        title: 'Assigned to Cold Calling',
        description: `Assigned to Cold Calling agent ${coldCaller.name} (Sales owner ${executive.name})`,
        actorId: actor._id,
        actorName: actor.name,
        actorRole: actor.role,
        meta: { assignmentId: doc._id, coldCallerId, originalSalesOwnerId: doc.originalSalesOwnerId, initialStatusReason: doc.initialStatusReason },
      })),
      { ordered: false }
    ).catch((error) => console.error('[ColdCalling] activity log failed (non-fatal):', error.message));
  }

  return {
    ok: true,
    statusCode: created.length ? 201 : 200,
    body: {
      assignedCount: created.length,
      alreadyAssignedCount: alreadyAssigned.length,
      coldCaller: { _id: coldCaller._id, name: coldCaller.name },
      assignments: [
        ...created.map((doc) => ({ leadId: String(doc.leadId), assignmentId: String(doc._id), alreadyAssigned: false })),
        ...alreadyAssigned.map((row) => ({ ...row, alreadyAssigned: true })),
      ],
    },
  };
}

/**
 * The authenticated Cold Caller's own current assignments (read-only). The caller id comes from the
 * session — never from the request — so one agent can never read another's list. Deleted leads are
 * hidden. Status is the lead's CURRENT bucket (same rule as everywhere); the immutable snapshot of
 * what it was when assigned is returned alongside.
 */
async function getMyColdCallingLeads({ coldCallerId, query = {} }) {
  await getConfig({ includeDisabled: false });
  const { page, limit, skip } = parsePagination(query, { defaultLimit: 25, maxLimit: 100 });

  const [result] = await ColdCallingAssignment.aggregate([
    { $match: { coldCallerId: new mongoose.Types.ObjectId(String(coldCallerId)), status: 'active' } },
    {
      $lookup: {
        from: 'leads',
        let: { leadRef: '$leadId' },
        pipeline: [
          { $match: { $expr: { $eq: ['$_id', '$$leadRef'] } } },
          { $project: { name: 1, leadId: 1, status: 1, statusReason: 1, assignedTo: 1, isDeleted: 1, destination: 1, travelDate: 1 } },
        ],
        as: 'lead',
      },
    },
    { $unwind: '$lead' },
    { $match: { 'lead.isDeleted': { $ne: true } } },
    {
      $addFields: {
        currentBucket: { $ifNull: [buildBucketExpression({ status: '$lead.status', statusReason: '$lead.statusReason' }), 'unclassified'] },
      },
    },
    {
      $facet: {
        rows: [
          { $sort: { assignedAt: -1, _id: -1 } },
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: 'users',
              let: { ownerRef: '$lead.assignedTo' },
              pipeline: [
                { $match: { $expr: { $eq: ['$_id', '$$ownerRef'] } } },
                { $project: { name: 1 } },
              ],
              as: 'currentOwner',
            },
          },
          {
            $project: {
              assignedAt: 1,
              initialBucket: 1,
              initialStatusReason: 1,
              originalSalesOwnerId: 1,
              originalSalesOwnerName: 1,
              currentBucket: 1,
              'lead._id': 1,
              'lead.name': 1,
              'lead.status': 1,
              'lead.statusReason': 1,
              'lead.destination': 1,
              'lead.travelDate': 1,
              currentOwner: { $arrayElemAt: ['$currentOwner', 0] },
            },
          },
        ],
        total: [{ $count: 'n' }],
      },
    },
  ]);

  // ONE extra query for the page (not per lead): this agent's own call activity on each lead.
  const calls = await summarizeMyCalls({ coldCallerId, leadIds: (result?.rows || []).map((row) => row.lead._id) });
  const rows = (result?.rows || []).map((row) => ({
    assignmentId: row._id,
    assignedAt: row.assignedAt,
    // destination / travelDate: the Lead's own fields, shown as-is (null when the lead has none).
    lead: { _id: row.lead._id, name: row.lead.name, destination: row.lead.destination || null, travelDate: row.lead.travelDate || null },
    bucket: row.currentBucket,
    status: row.lead.status,
    // Lifecycle (converted / lost) is separate from the Cold/Warm/Hot bucket above; null for a live lead.
    lifecycle: lifecycleOf(row.lead),
    statusReason: row.lead.statusReason || '',
    initial: { bucket: row.initialBucket, statusReason: row.initialStatusReason || '' },
    originalSalesOwner: { _id: row.originalSalesOwnerId, name: row.originalSalesOwnerName || '' },
    currentSalesOwner: row.currentOwner ? { _id: row.currentOwner._id, name: row.currentOwner.name } : null,
    canCall: canCallLead(row.lead),
    calls: {
      count: calls.get(String(row.lead._id))?.count || 0,
      lastCallAt: calls.get(String(row.lead._id))?.lastCallAt || null,
      lastOutcome: calls.get(String(row.lead._id))?.lastOutcome || '',
    },
  }));

  return paginatedResponse(rows, { page, limit, total: result?.total?.[0]?.n || 0 });
}

module.exports = {
  MAX_LEADS_PER_REQUEST,
  listColdCallingAgents,
  assignColdLeads,
  getMyColdCallingLeads,
};
