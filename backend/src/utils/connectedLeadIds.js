const CallNote = require('../models/CallNote');
const { withBranch } = require('./branchScope');

/** Canonical "connected" outcomes — derived from CallNote.OUTCOME_BUCKETS so this
 * never drifts from the bucketing logic used by Call Report / Executive Activity. */
const CONNECTED_OUTCOMES = Object.keys(CallNote.OUTCOME_BUCKETS).filter(
  (outcome) => CallNote.OUTCOME_BUCKETS[outcome] === 'connected'
);

/** Lead IDs with at least one CallNote whose outcome is in the canonical "connected" bucket. */
async function findConnectedLeadIds({ branchId } = {}) {
  const filter = withBranch({ outcome: { $in: CONNECTED_OUTCOMES } }, branchId);
  const ids = await CallNote.distinct('leadId', filter);
  return ids.filter(Boolean);
}

function wantsConnectedFilter(query = {}) {
  const flag = query.connected;
  return flag === '1' || flag === 'true' || flag === true;
}

/**
 * Lead IDs with at least one CallNote at all — any outcome, any user. Deliberately no `outcome`
 * or `userId` filter: "Called" means the same thing `attachFirstCall` (utils/firstCallInfo.js)
 * already means for the "First Call" badge — lead-wide, outcome-agnostic, actor-agnostic. Used by
 * the Admin "Engagement Status" filter (Opened, Not Called / Opened & Called).
 */
async function findCalledLeadIds({ branchId } = {}) {
  const filter = withBranch({}, branchId);
  const ids = await CallNote.distinct('leadId', filter);
  return ids.filter(Boolean);
}

module.exports = { findConnectedLeadIds, wantsConnectedFilter, findCalledLeadIds, CONNECTED_OUTCOMES };
