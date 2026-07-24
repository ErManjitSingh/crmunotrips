const FollowUp = require('../models/FollowUp');
const LeadNote = require('../models/LeadNote');

const COLD_REMINDER_HOURS = 4;

const COLD_REASON_LABELS = {
  not_answering: 'Not answering calls',
  asked_callback_later: 'Asked to call later',
  budget_not_ready: 'Budget not ready',
  dates_not_final: 'Travel dates not final',
  comparing_options: 'Comparing other options',
  low_interest: 'Low interest / browsing only',
  wrong_time: 'Called at wrong time',
  other: 'Other',
};

function coldReasonLabel(reason) {
  if (!reason) return 'Cold lead';
  return COLD_REASON_LABELS[reason] || reason;
}

function buildColdReminderAt(from = new Date()) {
  return new Date(from.getTime() + COLD_REMINDER_HOURS * 60 * 60 * 1000);
}

/**
 * When a lead is marked cold: store reason, create 4hr call reminder + note.
 * Skips creating a new reminder if one is already pending.
 */
async function scheduleColdLeadReminder(lead, { reason, user, notes } = {}) {
  if (!lead) return null;

  const coldReason = String(reason || lead.coldReason || '').trim();
  lead.temperature = 'cold';
  lead.isHot = false;
  if (coldReason) lead.coldReason = coldReason;

  const existingPending = lead.coldCallFollowUpId
    ? await FollowUp.findOne({
        _id: lead.coldCallFollowUpId,
        lead: lead._id,
        status: 'pending',
      }).lean()
    : await FollowUp.findOne({
        lead: lead._id,
        status: 'pending',
        category: 'cold',
        type: 'call',
        notes: { $regex: /cold lead/i },
      })
        .sort({ scheduledAt: -1 })
        .lean();

  if (existingPending) {
    lead.coldCallPending = true;
    lead.coldCallReminderAt = existingPending.scheduledAt;
    lead.coldCallFollowUpId = existingPending._id;
    await lead.save();
    return existingPending;
  }

  const scheduledAt = buildColdReminderAt();
  const reasonText = coldReasonLabel(coldReason);
  const noteText = [
    `Cold lead — next call in ${COLD_REMINDER_HOURS} hours.`,
    `Reason: ${reasonText}`,
    notes ? `Comment: ${notes}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  const followup = await FollowUp.create({
    lead: lead._id,
    branchId: lead.branchId || null,
    type: 'call',
    scheduledAt,
    status: 'pending',
    category: 'cold',
    priority: lead.priority || 'medium',
    notes: noteText,
    assignedTo: lead.assignedTo || user?._id,
    createdBy: user?._id || lead.assignedTo || lead.createdBy,
  });

  lead.coldCallPending = true;
  lead.coldCallReminderAt = scheduledAt;
  lead.coldCallFollowUpId = followup._id;
  lead.nextFollowUp = scheduledAt;
  await lead.save();

  if (user?._id) {
    await LeadNote.create({
      lead: lead._id,
      user: user._id,
      text: noteText,
    }).catch(() => {});
  }

  return followup;
}

/** Clear cold-call alert when executive marks call done. */
async function markColdCallDone(lead, { user, notes } = {}) {
  if (!lead) return null;

  lead.coldCallPending = false;
  lead.coldCallReminderAt = undefined;

  if (lead.coldCallFollowUpId) {
    await FollowUp.updateOne(
      { _id: lead.coldCallFollowUpId, status: 'pending' },
      {
        $set: {
          status: 'completed',
          completedAt: new Date(),
          outcome: notes || 'Cold call done',
        },
      }
    );
  } else {
    await FollowUp.updateMany(
      { lead: lead._id, category: 'cold', status: 'pending' },
      {
        $set: {
          status: 'completed',
          completedAt: new Date(),
          outcome: notes || 'Cold call done',
        },
      }
    );
  }

  lead.coldCallFollowUpId = undefined;
  await lead.save();

  if (user?._id) {
    await LeadNote.create({
      lead: lead._id,
      user: user._id,
      text: notes?.trim() || 'Cold call marked as done',
    }).catch(() => {});
  }

  return lead;
}

module.exports = {
  COLD_REASON_LABELS,
  COLD_REMINDER_HOURS,
  coldReasonLabel,
  buildColdReminderAt,
  scheduleColdLeadReminder,
  markColdCallDone,
};
