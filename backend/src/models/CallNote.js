const mongoose = require('mongoose');

const CALL_OUTCOMES = [
  // Warm / Hot / Cold (current)
  'discussed_package',
  'requested_callback',
  'cnp_same_day',
  'price_negotiation',
  'ready_to_book',
  'booked_elsewhere',
  'language_barrier',
  'not_interested',
  'invalid_number',
  'budget_issues',
  // legacy
  'interested',
  'need_better_hotel',
  'budget_issue',
  'call_back_later',
  'call_back_tomorrow',
  'no_answer',
  'busy',
  'other',
];

const callNoteSchema = new mongoose.Schema(
  {
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    /**
     * Role of the caller AT THE TIME of the call (userId is always the authenticated caller, never the
     * lead's owner). Lets team-wide Call Report totals exclude Cold Calling agents so they don't
     * distort Sales Executive metrics, and lets analytics tell the two apart. Absent on older calls.
     */
    callerRole: { type: String, trim: true },
    // No `enum` here on purpose: outcomes are admin-configurable (see
    // services/leadStatusConfigService.js), so a static Mongoose enum would silently block a
    // newly-added admin outcome from ever being saved. The authoritative category<->outcome
    // check now lives in enterpriseLeadController.addCallNote(), which validates against the
    // live config before this document is ever created — that is the real gate, not this field.
    outcome: { type: String, required: true },
    notes: { type: String, default: '', trim: true },
    /** Call talk time in seconds */
    duration: { type: Number, default: 0, min: 0 },
    startedAt: { type: Date },
    endedAt: { type: Date },
  },
  { timestamps: true }
);

callNoteSchema.index({ leadId: 1, createdAt: -1 });
// One Cold Calling call = one CallNote: the same (lead, agent, call start) submitted twice (double click,
// retry, two tabs) can never create a second record. Partial, so it only ever covers new Cold Calling
// calls — existing Sales calls (and any historical data) are outside it and cannot make the build fail.
callNoteSchema.index(
  { leadId: 1, userId: 1, startedAt: 1 },
  { unique: true, partialFilterExpression: { callerRole: 'cold_calling', startedAt: { $exists: true } }, name: 'unique_cold_calling_call_start' }
);

/**
 * Call Report bucketing: "connected" = guest answered (regardless of sales outcome),
 * "no_answer" = rang without pickup, "failed" = technical/unclassified.
 */
const OUTCOME_BUCKETS = {
  discussed_package: 'connected',
  requested_callback: 'connected',
  price_negotiation: 'connected',
  ready_to_book: 'connected',
  language_barrier: 'connected',
  not_interested: 'connected',
  budget_issues: 'connected',
  booked_elsewhere: 'connected',
  cnp_same_day: 'no_answer',
  cnp_for_same_day: 'no_answer',
  cnp: 'no_answer',
  busy: 'no_answer',
  no_answer: 'no_answer',
  invalid_number: 'failed',
  other: 'failed',
  // legacy
  interested: 'connected',
  need_better_hotel: 'connected',
  budget_issue: 'connected',
  call_back_later: 'connected',
  call_back_tomorrow: 'connected',
  // admin-added outcomes (via the Lead Status config) that were previously falling through to
  // the 'failed' default below and misclassifying otherwise-connected calls — same rule as
  // every other substantive outcome above: reaching this outcome required the guest to actually
  // pick up and speak with the executive, so it's a connected call regardless of sentiment.
  package_shared: 'connected',
  plan_cancel: 'connected',
  no_plan: 'connected',
};

function bucketOutcome(outcome) {
  return OUTCOME_BUCKETS[outcome] || 'failed';
}

module.exports = mongoose.model('CallNote', callNoteSchema);
module.exports.CALL_OUTCOMES = CALL_OUTCOMES;
module.exports.OUTCOME_BUCKETS = OUTCOME_BUCKETS;
module.exports.bucketOutcome = bucketOutcome;
