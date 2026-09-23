const LeadStatusMovement = require('../models/LeadStatusMovement');
const { MOVEMENTS } = LeadStatusMovement;
const { bucketForLead, BUCKETS } = require('../utils/listStatusBucketFilter');

/**
 * The single place every status-changing code path calls to record a Cold/Warm/Hot bucket
 * transition. Never throws — a failure here must never break the caller's actual status update
 * (see call sites in leadController/salesExecutiveController/enterpriseLeadController/
 * reactivationService), so every error is caught and logged, not propagated.
 *
 * Records exactly one event, and only when:
 *   - both the previous and next bucket are known (cold/warm/hot) — a brand-new lead, or a lead
 *     whose statusReason doesn't map to any bucket, has no "from" bucket and nothing is recorded
 *   - the two buckets differ — same-bucket status/statusReason edits are not a movement
 *
 * `previousStatus`/`previousStatusReason` must be captured by the caller BEFORE mutating the
 * lead; `lead` is read AFTER the new status/statusReason have been assigned (it does not need to
 * be saved yet — only its current in-memory values are read here).
 */
async function trackLeadStatusMovement({
  lead,
  previousStatus,
  previousStatusReason,
  actor,
  source,
}) {
  try {
    if (!lead || !lead._id) return null;

    const previousBucket = bucketForLead(previousStatus, previousStatusReason);
    const nextBucket = bucketForLead(lead.status, lead.statusReason);

    if (!previousBucket || !nextBucket) return null;
    if (previousBucket === nextBucket) return null;
    if (!BUCKETS.includes(previousBucket) || !BUCKETS.includes(nextBucket)) return null;

    return await LeadStatusMovement.create({
      leadId: lead._id,
      branchId: lead.branchId || null,
      fromBucket: previousBucket,
      toBucket: nextBucket,
      movement: `${previousBucket}_to_${nextBucket}`,
      changedAt: new Date(),
      changedBy: actor?._id || actor?.id || null,
      changedByName: actor?.name || 'System',
      source: source || '',
    });
  } catch (err) {
    console.error('[leadStatusMovementService] failed to record movement (non-fatal):', err?.message || err);
    return null;
  }
}

/**
 * Distinct lead ids that have ever recorded the given movement (e.g. 'cold_to_warm'). Used by
 * the Admin "Status Movement" filter — queries the transition ledger only, never the Lead
 * document's current status/statusReason. A lead that recorded the same movement more than once
 * still appears exactly once (`.distinct` dedupes by design).
 */
async function findLeadIdsForMovement(movement, { branchId } = {}) {
  if (!MOVEMENTS.includes(movement)) return [];
  const match = { movement };
  if (branchId) match.branchId = branchId;
  return LeadStatusMovement.distinct('leadId', match);
}

module.exports = { trackLeadStatusMovement, findLeadIdsForMovement, MOVEMENTS };
