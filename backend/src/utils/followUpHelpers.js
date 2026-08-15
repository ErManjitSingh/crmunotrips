const FollowUp = require('../models/FollowUp');
const Lead = require('../models/Lead');
const { promoteReactivatedLeadOnFollowUp } = require('../services/reactivationService');

const FOLLOWUP_CATEGORIES = [
  'call_picked',
  'call_not_picked',
  'dead_lead',
  'lost',
  'cold',
  'warm',
  'converted',
  'expected_conv',
];

const CALL_NOT_PICKED_REASON_LABELS = {
  invalid_number: 'Invalid no',
  switched_off: 'Switch off',
  speaking_to_someone_else: 'Speaking to someone else',
  not_reachable: 'Not reachable',
  not_answering: 'Not answer',
  // legacy
  does_not_exist: 'Does not exist',
};

const CALL_PICKED_OUTCOME_LABELS = {
  interested_quotation: 'Interested — needs quotation',
  requested_callback: 'Requested callback later',
  price_negotiation: 'Price negotiation ongoing',
  budget_issues: 'Budget issues / Costing issue',
  ready_to_book: 'Ready to book',
  not_interested: 'Not interested',
  converted: 'Converted to customer',
  rescheduled: 'Rescheduled per customer request',
  discussed_package: 'Discussed package',
  qualified: 'Qualified (requirements confirmed)',
  working_progress: 'Working in progress',
};

const TERMINAL_STATUSES = ['converted', 'lost', 'booked_from_another_company'];

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

  if (category === 'converted') {
    if (status === 'completed') {
      lead.status = 'converted';
    }
  } else if (category === 'expected_conv') {
    if (['new', 'contacted', 'follow_up'].includes(lead.status)) {
      lead.status = 'negotiation';
    }
  } else if (category === 'warm') {
    if (lead.status === 'new') {
      lead.status = 'follow_up';
    }
  } else if (category === 'call_picked') {
    const picked = body.pickedOutcome || body.outcome || '';
    if (picked === 'converted') {
      // conversion usually applied via statusUpdate API; keep if already converted
    } else if (picked === 'working_progress') {
      if (!TERMINAL_STATUSES.includes(lead.status)) lead.status = 'working_progress';
    } else if (picked === 'qualified') {
      if (!TERMINAL_STATUSES.includes(lead.status)) lead.status = 'qualified';
    } else if (!TERMINAL_STATUSES.includes(lead.status)) {
      // Connected → contacted; scheduler moves to WIP after 24h
      lead.status = 'contacted';
      if (picked) lead.statusReason = String(picked);
    }
  } else if (category === 'dead_lead' || category === 'lost') {
    lead.status = 'lost';
    lead.temperature = 'cold';
    lead.isHot = false;
    if (body.lostReason || body.outcome) {
      lead.statusReason = body.statusReason || body.lostReason || body.outcome;
    }
  } else if (category === 'call_not_picked') {
    // Tried calling but not answered — stay New (not Connected)
    if (lead.status === 'contacted') {
      /* keep connected if already was */
    } else if (!TERMINAL_STATUSES.includes(lead.status) && lead.status !== 'working_progress') {
      lead.status = 'new';
    }
  } else if (category === 'cold') {
    if (!TERMINAL_STATUSES.includes(lead.status)) {
      lead.status = 'follow_up';
    }
    lead.temperature = 'cold';
    lead.isHot = false;
  }

  promoteReactivatedLeadOnFollowUp(lead, lead.assignedTo);

  await lead.save();
}

function normalizeFollowUpPayload(body, user, lead) {
  const { buildColdReminderAt, coldReasonLabel } = require('../services/coldLeadService');
  let scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
  let category = FOLLOWUP_CATEGORIES.includes(body.category) ? body.category : 'call_picked';
  if (category === 'dead_lead') category = 'lost';

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

  if (category === 'cold' && body.coldReason) {
    const reasonText = coldReasonLabel(body.coldReason);
    const prefix = `Cold lead — reason: ${reasonText}. Auto reminder in 4 hours.`;
    notes = notes ? `${prefix} ${notes}` : prefix;
    outcome = body.coldReason;
  }

  if (category === 'call_not_picked') {
    const reasonKey = body.notPickedReason || body.outcome || '';
    const reasonText = CALL_NOT_PICKED_REASON_LABELS[reasonKey] || reasonKey;
    if (reasonKey) {
      outcome = reasonKey;
      const prefix = `Not connected — ${reasonText}`;
      notes = notes ? `${prefix}. ${notes}` : prefix;
    }
  }

  if (category === 'call_picked') {
    const pickedKey = body.pickedOutcome || body.outcome || '';
    const pickedText = CALL_PICKED_OUTCOME_LABELS[pickedKey] || pickedKey;
    if (pickedKey) {
      outcome = pickedKey;
      const prefix = `Connected — ${pickedText}`;
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
  buildFollowUpCategoryFilter,
  syncLeadFollowUpDates,
  applyCategoryToLead,
  normalizeFollowUpPayload,
};
