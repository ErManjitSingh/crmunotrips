const mongoose = require('mongoose');
const { BUCKETS } = require('../utils/listStatusBucketFilter');

/**
 * Append-only ledger of actual Cold/Warm/Hot bucket transitions — separate from `Lead` itself,
 * which only ever stores current-state fields (status/statusReason/temperature) and cannot
 * reconstruct history. One document per transition, written going forward from deployment;
 * never backfilled. See services/leadStatusMovementService.js for the single write path.
 */
const MOVEMENTS = BUCKETS.flatMap((from) =>
  BUCKETS.filter((to) => to !== from).map((to) => `${from}_to_${to}`)
);

const leadStatusMovementSchema = new mongoose.Schema(
  {
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', index: true },
    fromBucket: { type: String, enum: BUCKETS, required: true },
    toBucket: { type: String, enum: BUCKETS, required: true },
    movement: { type: String, enum: MOVEMENTS, required: true, index: true },
    changedAt: { type: Date, default: Date.now, required: true, index: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    changedByName: { type: String, trim: true, default: 'System' },
    /** Which write path produced this event, e.g. 'admin_lead_edit', 'call_note', 'bulk_status_update' */
    source: { type: String, trim: true, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

leadStatusMovementSchema.index({ leadId: 1, changedAt: -1 });
leadStatusMovementSchema.index({ movement: 1, changedAt: -1 });
leadStatusMovementSchema.index({ branchId: 1, movement: 1, changedAt: -1 });

module.exports = mongoose.model('LeadStatusMovement', leadStatusMovementSchema);
module.exports.MOVEMENTS = MOVEMENTS;
