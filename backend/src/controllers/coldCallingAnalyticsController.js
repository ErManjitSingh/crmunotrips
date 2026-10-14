const asyncHandler = require('../utils/asyncHandler');
const {
  parseColdCallingAnalyticsQuery,
  parseColdCallingAgentLeadsQuery,
  getColdCallingAnalytics,
  getColdCallingAgentDetail,
  getColdCallingAgentLeads,
} = require('../services/coldCallingAnalyticsService');
const { getAgentLeadActivityForAdmin } = require('../services/coldCallingLeadActivityService');

// Admin only (authorized in the route). req.branchId is the scope the auth middleware resolved from the
// authenticated Admin — the analytics never read a branch id straight from the request.

/** GET /leads/analytics/cold-calling */
const getColdCallingAnalyticsHandler = asyncHandler(async (req, res) => {
  res.json(await getColdCallingAnalytics(parseColdCallingAnalyticsQuery(req.query, req.branchId)));
});

/** GET /leads/analytics/cold-calling/:agentId */
const getColdCallingAgentDetailHandler = asyncHandler(async (req, res) => {
  const params = parseColdCallingAnalyticsQuery(req.query, req.branchId, { agentId: req.params.agentId });
  res.json(await getColdCallingAgentDetail({ ...params, agentId: params.agentId }));
});

/** GET /leads/analytics/cold-calling/:agentId/leads */
const getColdCallingAgentLeadsHandler = asyncHandler(async (req, res) => {
  res.json(await getColdCallingAgentLeads(parseColdCallingAgentLeadsQuery(req.query, req.params.agentId, req.branchId)));
});

/** GET /leads/analytics/cold-calling/:agentId/leads/:leadId/activity — the agent's day-wise opens + calls on one lead. */
const getColdCallingAgentLeadActivityHandler = asyncHandler(async (req, res) => {
  res.json(await getAgentLeadActivityForAdmin({ agentId: req.params.agentId, leadId: req.params.leadId, branchId: req.branchId }));
});

module.exports = { getColdCallingAnalyticsHandler, getColdCallingAgentDetailHandler, getColdCallingAgentLeadsHandler, getColdCallingAgentLeadActivityHandler };
