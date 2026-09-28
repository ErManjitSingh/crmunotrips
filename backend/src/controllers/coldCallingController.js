const asyncHandler = require('../utils/asyncHandler');
const { getMyColdCallingLeads } = require('../services/coldCallingAssignmentService');
const { getMyCallingSummary } = require('../services/coldCallingAnalyticsService');
const { recordLeadOpened, getAgentLeadActivity } = require('../services/coldCallingLeadActivityService');
const { listReassignOptions, reassignLeadToExecutive } = require('../services/coldCallingReassignService');
const { getClientIp } = require('../services/activityService');
const { loadAssignedLead, findExistingCall, listMyCallsForLead, assertLeadCallable } = require('../services/coldCallingCallService');
const { addCallNote } = require('./enterpriseLeadController');

/**
 * GET /cold-calling/my-leads — the signed-in Cold Caller's own assignments (read-only).
 * The identity is req.user, never a query/body value, so no parameter can widen it.
 */
const getMyLeadsHandler = asyncHandler(async (req, res) => {
  res.json(await getMyColdCallingLeads({ coldCallerId: req.user._id, query: req.query }));
});

/** GET /cold-calling/my-summary — the signed-in Cold Caller's own dashboard cards (identity from the session only). */
const getMySummaryHandler = asyncHandler(async (req, res) => {
  res.json(await getMyCallingSummary({ coldCallerId: req.user._id }));
});

/**
 * Gate for every per-lead Cold Calling route: the authenticated agent must hold an ACTIVE assignment
 * for :id, and the lead must exist (not deleted) in their branch. Nothing from the body is consulted.
 */
const requireAssignedLead = asyncHandler(async (req, res, next) => {
  req.coldCalling = await loadAssignedLead({ coldCallerId: req.user._id, leadId: req.params.id, branchId: req.branchId });
  next();
});

/** Calling (not reading history) additionally requires a lead that is not converted / lost. */
const requireCallableLead = (req, res, next) => {
  try {
    assertLeadCallable(req.coldCalling.lead);
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * POST /cold-calling/leads/:id/call-access — the Cold Calling twin of the Sales Executive's
 * call-access. It is the only place the real number reaches the browser, and only for a lead the
 * agent is assigned. Unlike the Sales version it does NOT mark the lead "opened by the Sales owner"
 * (that SLA belongs to the owner, not to a Cold Calling agent).
 */
const callAccessHandler = asyncHandler(async (req, res) => {
  const { lead } = req.coldCalling;
  // "Opened" for the per-lead history (when the agent opened this lead to dial). Never blocks the call.
  await recordLeadOpened({ lead, user: req.user });
  res.json({ opened: true, phone: lead.phone });
});

/**
 * POST /cold-calling/leads/:id/call-notes — call end. Runs the SAME addCallNote as every other role
 * (CallNote, duration, outcome, lead status, LeadStatusMovement, timeline, audit); the caller is
 * req.user. Two Cold-Calling-specific rules, both enforced here rather than trusted from the client:
 *  - no automatic "+2h" Sales follow-up is scheduled (follow-ups are out of scope for this role);
 *  - the same call submitted twice (double click / retry / stale UI) returns the existing CallNote.
 */
const addCallHandler = asyncHandler(async (req, res, next) => {
  req.body = { ...req.body, scheduleNextCall: false };

  const existing = await findExistingCall({ leadId: req.coldCalling.lead._id, userId: req.user._id, startedAt: req.body.startedAt });
  if (existing) return res.status(200).json({ ...existing, duplicate: true });

  return addCallNote(req, res, async (error) => {
    // Lost a race against an identical concurrent submission: the unique (lead, agent, startedAt) index
    // rejected the second CallNote before it changed anything.
    if (error?.code === 11000) {
      const winner = await findExistingCall({ leadId: req.coldCalling.lead._id, userId: req.user._id, startedAt: req.body.startedAt });
      if (winner) return res.status(200).json({ ...winner, duplicate: true });
    }
    return next(error);
  });
});

/** GET /cold-calling/leads/:id/call-history — this agent's own calls on the lead. */
const callHistoryHandler = asyncHandler(async (req, res) => {
  res.json(await listMyCallsForLead({ coldCallerId: req.user._id, leadId: req.coldCalling.lead._id, query: req.query }));
});

/** GET /cold-calling/leads/:id/activity — this agent's opens + calls on the lead, grouped by day. */
const leadActivityHandler = asyncHandler(async (req, res) => {
  res.json(await getAgentLeadActivity({ coldCallerId: req.user._id, leadId: req.coldCalling.lead._id }));
});

/**
 * GET /cold-calling/leads/:id/reassign-options — eligible Sales Executives (active, same branch as the lead,
 * excluding the current owner). Only reachable for a lead the agent holds an ACTIVE assignment on.
 */
const reassignOptionsHandler = asyncHandler(async (req, res) => {
  res.json(await listReassignOptions({ leadId: req.coldCalling.lead._id }));
});

/**
 * POST /cold-calling/leads/:id/reassign { executiveId, expectedCurrentOwnerId? } — transfer the lead's
 * current Sales ownership to another executive (same Lead document; see coldCallingReassignService).
 * requireAssignedLead has already proven the agent's ACTIVE assignment; everything else is re-validated
 * server-side from the database.
 */
const reassignHandler = asyncHandler(async (req, res) => {
  const { executiveId, expectedCurrentOwnerId } = req.body || {};
  res.json(await reassignLeadToExecutive({
    actor: req.user,
    assignment: req.coldCalling.assignment,
    leadId: req.coldCalling.lead._id,
    executiveId: typeof executiveId === 'string' ? executiveId : undefined,
    expectedCurrentOwnerId: typeof expectedCurrentOwnerId === 'string' ? expectedCurrentOwnerId : undefined,
    ip: getClientIp(req),
  }));
});

module.exports = { getMyLeadsHandler, getMySummaryHandler, leadActivityHandler, reassignOptionsHandler, reassignHandler, requireAssignedLead, requireCallableLead, callAccessHandler, addCallHandler, callHistoryHandler };
