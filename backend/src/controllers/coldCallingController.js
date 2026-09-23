const asyncHandler = require('../utils/asyncHandler');
const { getMyColdCallingLeads } = require('../services/coldCallingAssignmentService');
const { loadAssignedLead, findExistingCall, listMyCallsForLead, assertLeadCallable } = require('../services/coldCallingCallService');
const { addCallNote } = require('./enterpriseLeadController');

/**
 * GET /cold-calling/my-leads — the signed-in Cold Caller's own assignments (read-only).
 * The identity is req.user, never a query/body value, so no parameter can widen it.
 */
const getMyLeadsHandler = asyncHandler(async (req, res) => {
  res.json(await getMyColdCallingLeads({ coldCallerId: req.user._id, query: req.query }));
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

module.exports = { getMyLeadsHandler, requireAssignedLead, requireCallableLead, callAccessHandler, addCallHandler, callHistoryHandler };
