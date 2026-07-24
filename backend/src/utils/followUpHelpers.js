const FollowUp = require('../models/FollowUp');
const Lead = require('../models/Lead');
const { promoteReactivatedLeadOnFollowUp } = require('../services/reactivationService');

const FOLLOWUP_CATEGORIES = ['warm', 'cold', 'converted', 'expected_conv'];

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
  } else if (category === 'warm') {
    if (lead.status === 'new') {
      lead.status = 'follow_up';
    }
  }

  promoteReactivatedLeadOnFollowUp(lead, lead.assignedTo);

  await lead.save();
}

function normalizeFollowUpPayload(body, user, lead) {
  const { buildColdReminderAt, coldReasonLabel } = require('../services/coldLeadService');
  let scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
  const category = FOLLOWUP_CATEGORIES.includes(body.category) ? body.category : 'warm';

  if ((!scheduledAt || Number.isNaN(scheduledAt.getTime())) && category === 'cold') {
    scheduledAt = buildColdReminderAt();
  }

  if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) {
    const err = new Error('Valid scheduledAt is required');
    err.statusCode = 400;
    throw err;
  }

  let notes = body.notes || body.remarks || '';
  if (category === 'cold' && body.coldReason) {
    const reasonText = coldReasonLabel(body.coldReason);
    const prefix = `Cold lead — reason: ${reasonText}. Auto reminder in 4 hours.`;
    notes = notes ? `${prefix} ${notes}` : prefix;
  }

  return {
    lead: lead._id,
    type: body.type || 'call',
    scheduledAt,
    notes,
    outcome: body.outcome || '',
    priority: body.priority || lead.priority || 'medium',
    category,
    assignedTo: body.assignedTo || lead.assignedTo || user._id,
    createdBy: user._id,
    status: 'pending',
  };
}

module.exports = {
  FOLLOWUP_CATEGORIES,
  buildFollowUpCategoryFilter,
  syncLeadFollowUpDates,
  applyCategoryToLead,
  normalizeFollowUpPayload,
};
