const asyncHandler = require('../utils/asyncHandler');
const { listColdCallingAgents, assignColdLeads } = require('../services/coldCallingAssignmentService');
const {
  getExecutiveLeadStatus,
  getExecutiveLeadStatusLeads,
  parseExecutiveLeadStatusQuery,
  parseExecutiveLeadStatusLeadsQuery,
} = require('../services/executiveLeadStatusService');

// Both handlers are Admin only (authorized in the route). req.branchId is the scope resolved by
// the auth middleware, not a raw client value.

/** GET /leads/analytics/executive-lead-status */
const getExecutiveLeadStatusHandler = asyncHandler(async (req, res) => {
  const params = parseExecutiveLeadStatusQuery(req.query, req.branchId);
  res.json(await getExecutiveLeadStatus(params));
});

/** GET /leads/analytics/executive-lead-status/:executiveId/leads */
const getExecutiveLeadStatusLeadsHandler = asyncHandler(async (req, res) => {
  const params = parseExecutiveLeadStatusLeadsQuery(req.query, req.params.executiveId, req.branchId);
  res.json(await getExecutiveLeadStatusLeads(params));
});

/** GET /leads/analytics/executive-lead-status/cold-calling/agents — active Cold Calling users for the picker. */
const listColdCallingAgentsHandler = asyncHandler(async (req, res) => {
  res.json({ data: await listColdCallingAgents({ branchId: req.branchId || null }) });
});

/** POST /leads/analytics/executive-lead-status/cold-calling/assign — send Cold leads to a Cold Calling agent. */
const assignColdLeadsHandler = asyncHandler(async (req, res) => {
  const result = await assignColdLeads({ actor: req.user, branchId: req.branchId || null, body: req.body });
  if (!result.ok) return res.status(result.statusCode).json({ message: result.message, failures: result.failures });
  return res.status(result.statusCode).json(result.body);
});

module.exports = {
  getExecutiveLeadStatusHandler,
  getExecutiveLeadStatusLeadsHandler,
  listColdCallingAgentsHandler,
  assignColdLeadsHandler,
};
