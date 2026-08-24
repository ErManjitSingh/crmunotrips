const FollowUp = require('../models/FollowUp');
const Lead = require('../models/Lead');
const { promoteReactivatedLeadOnFollowUp } = require('../services/reactivationService');

const FOLLOWUP_CATEGORIES = [
  'warm',
  'hot',
  'cold',
  // legacy
  'call_picked',
  'call_not_picked',
  'dead_lead',
  'lost',
  'converted',
  'expected_conv',
];

const WARM_OUTCOME_LABELS = {
  discussed_package: 'Package discussed',
  requested_callback: 'Request call back',
  cnp_same_day: 'CNP for same day',
  price_negotiation: 'Price negotiation going on',
};

const HOT_OUTCOME_LABELS = {
  ready_to_book: 'Ready to Book',
};

const COLD_OUTCOME_LABELS = {
  booked_elsewhere: 'Booked from another company',
  language_barrier: 'Language barrier',
  not_interested: 'Not interested',
  invalid_number: 'Invalid no',
  budget_issues: 'Budget issues',
};

/** @deprecated legacy labels kept for old follow-up notes */
const CALL_NOT_PICKED_REASON_LABELS = {
  cnp_same_day: 'CNP for same day',
  invalid_number: 'Invalid no',
  switched_off: 'Switch off',
  speaking_to_someone_else: 'Speaking to someone else',
  not_reachable: 'Not reachable',
  not_answering: 'Not answer',
  does_not_exist: 'Does not exist',
};

const CALL_PICKED_OUTCOME_LABELS = {
  ...WARM_OUTCOME_LABELS,
  ...HOT_OUTCOME_LABELS,
  interested_quotation: 'Interested — needs quotation',
  budget_issues: 'Budget issues',
  not_interested: 'Not interested',
  booked_elsewhere: 'Booked from another company',
  converted: 'Converted to customer',
  rescheduled: 'Rescheduled per customer request',
  qualified: 'Qualified (requirements confirmed)',
  working_progress: 'Working in progress',
};

const TERMINAL_STATUSES = ['converted', 'lost', 'booked_from_another_company'];

function outcomeLabel(category, key) {
  if (category === 'hot') return HOT_OUTCOME_LABELS[key] || key;
  if (category === 'cold') return COLD_OUTCOME_LABELS[key] || key;
  if (category === 'warm') return WARM_OUTCOME_LABELS[key] || key;
  return (
    CALL_PICKED_OUTCOME_LABELS[key] ||
    CALL_NOT_PICKED_REASON_LABELS[key] ||
    COLD_OUTCOME_LABELS[key] ||
    key
  );
}

function buildFollowUpCategoryFilter(category) {
  if (category && FOLLOWUP_CATEGORIES.includes(category)) {
    return { category };
  }
  return {};
}

async function syncLeadFollowUpDates(leadId) {
  const lead = await Lead.findById(leadId);
  if (!lead) return;

  const [lastCompleted, nextPending] = await Promise.all([
    FollowUp.findOne({ lead: leadId, status: 'completed' })
      .sort({ completedAt: -1, scheduledAt: -1 })
      .select('completedAt scheduledAt')
      .lean(),
    FollowUp.findOne({ lead: leadId, status: 'pending' })
      .sort({ scheduledAt: 1 })
      .select('scheduledAt')
      .lean(),
  ]);

  lead.lastFollowUp = lastCompleted
    ? lastCompleted.completedAt || lastCompleted.scheduledAt
    : lead.lastFollowUp;
  lead.nextFollowUp = nextPending?.scheduledAt || undefined;
  if (!nextPending) lead.nextFollowUp = undefined;

  await lead.save();
}

async function applyCategoryToLead(lead, category, status, body = {}) {
  if (!lead || !category) return;

  const outcomeKey = String(
    body.pickedOutcome ||
      body.warmOutcome ||
      body.hotOutcome ||
      body.notPickedReason ||
      body.coldReason ||
      body.lostReason ||
      body.outcome ||
      ''
  ).trim();

  if (category === 'converted') {
    if (status === 'completed') {
      lead.status = 'converted';
      if (!lead.convertedAt) lead.convertedAt = new Date();
    }
  } else if (category === 'expected_conv') {
    if (['new', 'contacted', 'follow_up'].includes(lead.status)) {
      lead.status = 'negotiation';
    }
  } else if (category === 'warm' || category === 'call_picked') {
    if (!TERMINAL_STATUSES.includes(lead.status)) {
      lead.status = outcomeKey === 'cnp_same_day' ? 'follow_up' : 'contacted';
    }
    lead.temperature = 'warm';
    lead.isHot = false;
    if (body.statusReason) lead.statusReason = String(body.statusReason).trim();
    else if (outcomeKey) lead.statusReason = String(outcomeKey);
  } else if (category === 'hot') {
    if (!TERMINAL_STATUSES.includes(lead.status)) {
      lead.status = 'negotiation';
    }
    lead.temperature = 'hot';
    lead.isHot = true;
    if (body.statusReason) lead.statusReason = String(body.statusReason).trim();
    else if (outcomeKey) lead.statusReason = String(outcomeKey);
  } else if (category === 'cold') {
    if (!TERMINAL_STATUSES.includes(lead.status)) {
      lead.status = 'follow_up';
    }
    lead.temperature = 'cold';
    lead.isHot = false;
    if (body.statusReason) lead.statusReason = String(body.statusReason).trim();
    else if (outcomeKey) lead.statusReason = String(outcomeKey);
    else if (body.coldReason) lead.statusReason = String(body.coldReason).trim();
  } else if (category === 'dead_lead' || category === 'lost') {
    if (outcomeKey === 'booked_elsewhere') {
      lead.status = 'booked_from_another_company';
    } else {
      lead.status = 'lost';
    }
    lead.temperature = 'cold';
    lead.isHot = false;
    if (body.lostReason || body.outcome || body.statusReason) {
      lead.statusReason = body.statusReason || body.lostReason || body.outcome;
    }
  } else if (category === 'call_not_picked') {
    if (lead.status === 'contacted') {
      /* keep connected */
    } else if (
      TERMINAL_STATUSES.includes(lead.status) ||
      ['working_progress', 'qualified', 'quotation_sent', 'negotiation', 'follow_up'].includes(lead.status)
    ) {
      /* keep current pipeline status */
    } else {
      lead.status = 'follow_up';
    }
    lead.temperature = 'warm';
    lead.isHot = false;
    if (body.statusReason) lead.statusReason = String(body.statusReason).trim();
    else if (outcomeKey) lead.statusReason = String(outcomeKey);
  }

  promoteReactivatedLeadOnFollowUp(lead, lead.assignedTo);

  await lead.save();
}

function normalizeFollowUpPayload(body, user, lead) {
  const { buildColdReminderAt, coldReasonLabel } = require('../services/coldLeadService');
  let scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
  let category = FOLLOWUP_CATEGORIES.includes(body.category) ? body.category : 'warm';
  if (category === 'dead_lead') category = 'lost';
  if (category === 'call_picked') category = 'warm';
  if (category === 'call_not_picked') category = 'warm';

  if ((!scheduledAt || Number.isNaN(scheduledAt.getTime())) && category === 'cold') {
    scheduledAt = buildColdReminderAt();
  }

  if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) {
    const err = new Error('Valid scheduledAt is required');
    err.statusCode = 400;
    throw err;
  }

  let notes = body.notes || body.remarks || '';
  let outcome = body.outcome || '';

  const outcomeKey = String(
    body.pickedOutcome ||
      body.warmOutcome ||
      body.hotOutcome ||
      body.notPickedReason ||
      body.coldReason ||
      body.lostReason ||
      body.outcome ||
      ''
  ).trim();

  if (category === 'cold') {
    const reasonText =
      COLD_OUTCOME_LABELS[outcomeKey] || coldReasonLabel(body.coldReason || outcomeKey);
    if (outcomeKey) {
      outcome = outcomeKey;
      const prefix = `Cold — ${reasonText}`;
      notes = notes ? `${prefix}. ${notes}` : prefix;
    }
  }

  if (category === 'warm') {
    const pickedText = WARM_OUTCOME_LABELS[outcomeKey] || outcomeKey;
    if (outcomeKey) {
      outcome = outcomeKey;
      const prefix = `Warm — ${pickedText}`;
      notes = notes ? `${prefix}. ${notes}` : prefix;
    }
  }

  if (category === 'hot') {
    const hotText = HOT_OUTCOME_LABELS[outcomeKey] || outcomeKey;
    if (outcomeKey) {
      outcome = outcomeKey;
      const prefix = `Hot — ${hotText}`;
      notes = notes ? `${prefix}. ${notes}` : prefix;
    }
  }

  if (category === 'lost') {
    const lostKey = body.lostReason || body.outcome || '';
    if (!String(notes || '').trim() && !String(body.remarks || '').trim()) {
      const err = new Error('Comment is required for Lost lead');
      err.statusCode = 400;
      throw err;
    }
    outcome = lostKey || 'lost';
    const prefix = 'Lost lead';
    notes = notes ? `${prefix}. ${notes}` : prefix;
  }

  return {
    lead: lead._id,
    type: body.type || 'call',
    scheduledAt,
    notes,
    outcome,
    priority: body.priority || lead.priority || 'medium',
    category,
    assignedTo: body.assignedTo || lead.assignedTo || user._id,
    createdBy: user._id,
    status: 'pending',
  };
}

module.exports = {
  FOLLOWUP_CATEGORIES,
  CALL_NOT_PICKED_REASON_LABELS,
  CALL_PICKED_OUTCOME_LABELS,
  WARM_OUTCOME_LABELS,
  HOT_OUTCOME_LABELS,
  COLD_OUTCOME_LABELS,
  outcomeLabel,
  buildFollowUpCategoryFilter,
  syncLeadFollowUpDates,
  applyCategoryToLead,
  normalizeFollowUpPayload,
};
