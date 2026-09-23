const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const CallNote = require('../models/CallNote');
const ColdCallingAssignment = require('../models/ColdCallingAssignment');
const ApiError = require('../utils/apiError');
const { parsePagination, paginatedResponse } = require('../utils/pagination');

/**
 * Cold Calling reuses the CRM's one calling mechanism (call-access -> dial -> enterpriseLeadController
 * .addCallNote -> CallNote / status / timeline). This module only adds what is specific to the role:
 * proving the signed-in agent may work THIS lead, and reading their own call history.
 *
 * The authority for "may this agent call this lead" is the database, never the client: an ACTIVE
 * ColdCallingAssignment for (lead, authenticated user), on a lead that still exists in the agent's branch.
 * Every failure is the same 404 so a lead id can't be probed for existence.
 */

const NOT_FOUND = () => new ApiError(404, 'Lead not found');

/**
 * Statuses in which a lead is finished. Calling eligibility ends here (an agent must not keep dialing a
 * customer who already booked or was lost), but the assignment and every call stay in place and
 * reportable — this only gates new calls, never history. Same list the Sales stall rules use.
 */
const { TERMINAL_STATUSES } = require('./leadExecutiveStallService');
/** 'converted' | 'lost' | null — the lead's lifecycle, derived from the same terminal-status list as canCallLead. */
const lifecycleOf = (lead) => {
  if (!TERMINAL_STATUSES.includes(lead?.status)) return null;
  return lead.status === 'converted' ? 'converted' : 'lost';
};
const canCallLead = (lead) => lifecycleOf(lead) === null;
const assertLeadCallable = (lead) => {
  if (!canCallLead(lead)) throw new ApiError(409, 'This lead is closed (converted or lost) and can no longer be called');
};

async function loadAssignedLead({ coldCallerId, leadId, branchId }) {
  if (typeof leadId !== 'string' || !mongoose.isValidObjectId(leadId) || !/^[a-f0-9]{24}$/i.test(leadId)) throw NOT_FOUND();

  const assignment = await ColdCallingAssignment.findOne({ leadId, coldCallerId, status: 'active' })
    .select('_id leadId branchId')
    .lean();
  if (!assignment) throw NOT_FOUND();

  const lead = await Lead.findOne({
    _id: assignment.leadId,
    isDeleted: { $ne: true },
    ...(branchId ? { branchId } : {}),
  })
    .select('name phone branchId status')
    .lean();
  if (!lead) throw NOT_FOUND();
  return { assignment, lead };
}

/** A duplicate CallNote (same agent, lead and call start) is the same call submitted twice. */
async function findExistingCall({ leadId, userId, startedAt }) {
  const started = startedAt ? new Date(startedAt) : null;
  if (!started || Number.isNaN(started.getTime())) return null;
  return CallNote.findOne({ leadId, userId, startedAt: started }).populate('userId', 'name role').lean();
}

/** The agent's OWN calls on one lead, newest first. Other users' calls and notes are never returned. */
async function listMyCallsForLead({ coldCallerId, leadId, query = {} }) {
  const { page, limit, skip } = parsePagination(query, { defaultLimit: 20, maxLimit: 50 });
  const filter = { leadId, userId: coldCallerId };
  const [rows, total] = await Promise.all([
    CallNote.find(filter)
      .select('outcome notes duration startedAt endedAt createdAt userId')
      .populate('userId', 'name')
      .sort({ startedAt: -1, createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    CallNote.countDocuments(filter),
  ]);
  return paginatedResponse(
    rows.map((row) => ({
      _id: row._id,
      caller: { _id: row.userId?._id, name: row.userId?.name || '' },
      outcome: row.outcome,
      notes: row.notes || '',
      duration: row.duration || 0,
      startedAt: row.startedAt || row.createdAt,
      endedAt: row.endedAt || null,
    })),
    { page, limit, total }
  );
}

/** One aggregation for a whole page of leads: this agent's call count / last call / last outcome per lead. */
async function summarizeMyCalls({ coldCallerId, leadIds }) {
  if (!leadIds.length) return new Map();
  const rows = await CallNote.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(String(coldCallerId)), leadId: { $in: leadIds } } },
    { $addFields: { at: { $ifNull: ['$startedAt', '$createdAt'] } } },
    { $sort: { at: -1, _id: -1 } },
    { $group: { _id: '$leadId', count: { $sum: 1 }, lastCallAt: { $first: '$at' }, lastOutcome: { $first: '$outcome' }, totalDuration: { $sum: '$duration' } } },
  ]);
  return new Map(rows.map((row) => [String(row._id), row]));
}

module.exports = { lifecycleOf, canCallLead, assertLeadCallable, loadAssignedLead, findExistingCall, listMyCallsForLead, summarizeMyCalls };
