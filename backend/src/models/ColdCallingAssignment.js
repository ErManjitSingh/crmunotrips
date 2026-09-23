const mongoose = require('mongoose');

/**
 * "Cold Calling was assigned to work this lead" — a historical fact, kept separate from Sales
 * ownership on purpose.
 *
 *   Lead.assignedTo            the CURRENT Sales owner; changes whenever the lead is reassigned.
 *   ColdCallingAssignment      who Cold Calling assigned it to, and which Sales Executive's Cold lead
 *                              it was WHEN it was sent. Never rewritten by later ownership or status
 *                              changes, and never touches Lead.assignedTo.
 *
 * Snapshot fields (original owner, initial reason, names) are immutable by design: they answer
 * "what was true at assignment time", which the live Lead cannot once it has moved on.
 *
 * `status` is what makes "one current assignment per lead" a database rule (see the partial unique
 * index below) while leaving room for a later phase to close an assignment without deleting it.
 * Phase 3 only ever writes 'active'.
 */
const coldCallingAssignmentSchema = new mongoose.Schema(
  {
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true },
    /** The lead's branch at assignment time; the Cold Caller is required to be in the same one. */
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },

    coldCallerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    coldCallerName: { type: String, trim: true, default: '' },

    /** The Sales Executive who owned the lead when it was sent to Cold Calling. NOT the current owner. */
    originalSalesOwnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    originalSalesOwnerName: { type: String, trim: true, default: '' },

    /** Always 'cold' — only Cold leads can be assigned. Kept as data so history stays self-describing. */
    initialBucket: { type: String, enum: ['cold'], required: true, default: 'cold' },
    /** The lead's raw statusReason key at that moment (e.g. cnp_same_day) — never re-derived from later config. */
    initialStatusReason: { type: String, trim: true, default: '' },

    status: { type: String, enum: ['active', 'closed'], default: 'active', required: true },

    assignedAt: { type: Date, default: Date.now, required: true },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assignedByName: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

// One CURRENT assignment per lead, enforced by the database — this is what makes double clicks,
// retries and two Admins racing safe. Closed assignments (a later phase) don't count.
coldCallingAssignmentSchema.index(
  { leadId: 1 },
  { unique: true, partialFilterExpression: { status: 'active' }, name: 'unique_active_assignment_per_lead' }
);
// Cold Caller "My Leads" (and the Admin agent picker): a caller's current assignments, newest first.
coldCallingAssignmentSchema.index({ coldCallerId: 1, status: 1, assignedAt: -1 });
// Cold Calling analytics: every report starts with "assignments in this branch in this period".
coldCallingAssignmentSchema.index({ branchId: 1, assignedAt: -1 });

module.exports = mongoose.model('ColdCallingAssignment', coldCallingAssignmentSchema);
