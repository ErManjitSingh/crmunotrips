const { getLeaderLeadScopeFilter } = require('./teamScopeService');

/**
 * Extra Mongo filter so role panels only see their own leads on shared /api/leads routes.
 * Admin / lead_provider / sales_manager / ops keep branch-only scope (via req.branchId).
 */
async function getLeadViewerExtraFilter(req) {
  const role = req.user?.role;
  if (role === 'sales_executive') {
    return { assignedTo: req.user._id };
  }
  if (role === 'team_leader') {
    return getLeaderLeadScopeFilter(req.user._id);
  }
  return {};
}

function isRestrictedLeadViewer(role) {
  return role === 'sales_executive' || role === 'team_leader';
}

module.exports = {
  getLeadViewerExtraFilter,
  isRestrictedLeadViewer,
};
