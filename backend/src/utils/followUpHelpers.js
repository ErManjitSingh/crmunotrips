const FollowUp = require('../models/FollowUp');
const Lead = require('../models/Lead');
const { promoteReactivatedLeadOnFollowUp } = require('../services/reactivationService');

const FOLLOWUP_CATEGORIES = [
  'call_picked',
  'call_not_picked',
  'dead_lead',
  'cold',
  'warm',
  'converted',
  'expected_conv',
];

const CALL_NOT_PICKED_REASON_LABELS = {
  switched_off: 'Switched off',
  not_reachable: 'Not reachable',
  not_answering: 'Not answering',
  does_not_exist: 'Does not exist',
};

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

async function applyCategoryToLead(lead, category, status) {
  if (!lead || !category) return;

  if (category === 'converted') {
    if (status === 'completed') {
      lead.status = 'converted';
    }
  } else if (category === 'expected_conv') {
    if (['new', 'contacted', 'follow_up'].includes(lead.status)) {
      lead.status = 'negotiation';
    }
  } else if (category === 'warm' || category === 'call_picked') {
    if (lead.status === 'new') {
      lead.status = 'follow_up';
    }
  } else if (category === 'dead_lead') {
    lead.status = 'lost';
    lead.temperature = 'cold';
    lead.isHot = false;
  } else if (category === 'call_not_picked') {
    if (lead.status === 'new') {
      lead.status = 'contacted';
    }
  }

  promoteReactivatedLeadOnFollowUp(lead, lead.assignedTo);

  await lead.save();
}

function normalizeFollowUpPayload(body, user, lead) {
  const { buildColdReminderAt, coldReasonLabel } = require('../services/coldLeadService');
  let scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
  const category = FOLLOWUP_CATEGORIES.includes(body.category) ? body.category : 'call_picked';

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
  }

  if (category === 'call_not_picked') {
    const reasonKey = body.notPickedReason || body.outcome || '';
    const reasonText = CALL_NOT_PICKED_REASON_LABELS[reasonKey] || reasonKey;
    if (reasonKey) {
      outcome = reasonKey;
      const prefix = `Call not picked — ${reasonText}`;
      notes = notes ? `${prefix}. ${notes}` : prefix;
    }
  }

  if (category === 'dead_lead') {
    const prefix = 'Dead lead';
    notes = notes ? `${prefix}. ${notes}` : prefix;
    outcome = outcome || 'dead_lead';
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
