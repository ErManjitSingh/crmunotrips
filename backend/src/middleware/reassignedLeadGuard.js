const ApiError = require('../utils/apiError');
const { findReassignedAway, reassignedMessage } = require('../services/coldCallingReassignService');

/**
 * `router.param` guard for lead-id routes used by Sales Executives. The real authorization is unchanged
 * and already denies a previous owner (every executive lead query is scoped by `assignedTo: req.user._id`);
 * this only replaces the resulting generic 404 with the reason, when the lead was reassigned away from
 * them through Cold Calling:
 *
 *   403 "This lead has been reassigned to Aman and is no longer part of your active leads."
 *
 * It never grants anything: for any other role, for the current owner, or for any lead that wasn't
 * reassigned away from this user, it just calls next() and the normal handler decides.
 */
async function rejectReassignedAwayLead(req, res, next, leadId) {
  try {
    if (req.user?.role !== 'sales_executive' || !/^[a-f0-9]{24}$/i.test(String(leadId || ''))) return next();
    const found = await findReassignedAway({ executiveId: req.user._id, leadId: String(leadId) });
    if (!found) return next();
    const error = new ApiError(403, reassignedMessage(found.currentOwner?.name));
    error.code = 'LEAD_REASSIGNED';
    return next(error);
  } catch (error) {
    return next(error);
  }
}

module.exports = { rejectReassignedAwayLead };
