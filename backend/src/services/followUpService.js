const FollowUp = require('../models/FollowUp');
const Lead = require('../models/Lead');
const Notification = require('../models/Notification');
const ApiError = require('../utils/apiError');
const { FOLLOWUP_POPULATE } = require('../utils/queryHelpers');
const { NOTIFICATION_TYPES } = require('../constants/notificationTypes');
const { notifyFollowUpOutcome } = require('./notificationService');
const {
  normalizeFollowUpPayload,
  syncLeadFollowUpDates,
  applyCategoryToLead,
  FOLLOWUP_CATEGORIES,
} = require('../utils/followUpHelpers');
const { onLeadConverted } = require('./leadConversionService');
const { logLeadActivity } = require('./leadActivityService');

async function resolveMissedAlertsForLead(leadId, followUpId) {
  const leadIdStr = leadId?.toString?.() || `${leadId}`;
  await Notification.updateMany(
    {
      type: NOTIFICATION_TYPES.FOLLOWUP_MISSED,
      'meta.leadId': { $in: [leadId, leadIdStr] },
      'meta.resolved': { $ne: true },
    },
    {
      $set: {
        read: true,
        'meta.resolved': true,
        'meta.resolvedAt': new Date(),
        'meta.resolvedByFollowUpId': followUpId,
      },
    }
  );
}

function describeFollowUp(payloadOrDoc, body = {}) {
  const category = payloadOrDoc.category || body.category || 'warm';
  const type = (payloadOrDoc.type || body.type || 'call').replace(/_/g, ' ');
  const when = payloadOrDoc.scheduledAt
    ? new Date(payloadOrDoc.scheduledAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : '';
  const outcome = body.outcome || body.warmOutcome || body.hotOutcome || body.coldReason || payloadOrDoc.outcome || '';
  const notes = body.notes || body.remarks || payloadOrDoc.notes || '';
  return [category, type, when && `at ${when}`, outcome, notes].filter(Boolean).join(' · ');
}

async function createFollowUpForLead({ body, user, leadFilter = null }) {
  const leadId = body.lead || body.leadId;
  const leadQuery = { _id: leadId };
  if (leadFilter) Object.assign(leadQuery, leadFilter);

  const lead = await Lead.findOne(leadQuery);
  if (!lead) throw new ApiError(404, 'Lead not found');

  let payload;
  try {
    payload = normalizeFollowUpPayload(body, user, lead);
    payload.branchId = lead.branchId || user.branchId || null;
  } catch (e) {
    throw new ApiError(e.statusCode || 400, e.message);
  }

  const followup = await FollowUp.create(payload);
  await applyCategoryToLead(lead, payload.category, 'pending', body);
  await syncLeadFollowUpDates(lead._id);
  await resolveMissedAlertsForLead(lead._id, followup._id);

  if (payload.category === 'cold' && !['invalid_number', 'not_interested', 'booked_elsewhere'].includes(String(body.coldReason || payload.outcome || ''))) {
    const LeadNote = require('../models/LeadNote');
    lead.temperature = 'cold';
    lead.isHot = false;
    if (body.coldReason) lead.coldReason = String(body.coldReason).trim();
    lead.coldCallPending = true;
    lead.coldCallReminderAt = payload.scheduledAt;
    lead.coldCallFollowUpId = followup._id;
    await lead.save();
    if (user?._id && (body.coldReason || payload.notes)) {
      await LeadNote.create({
        lead: lead._id,
        user: user._id,
        text: payload.notes || `Cold lead — reason: ${body.coldReason}`,
      }).catch(() => {});
    }
  }

  await logLeadActivity({
    leadId: lead._id,
    branchId: lead.branchId,
    type: 'followup_created',
    description: describeFollowUp(payload, body),
    actor: user,
    meta: {
      followUpId: followup._id,
      category: payload.category,
      scheduledAt: payload.scheduledAt,
      outcome: payload.outcome || body.outcome || undefined,
    },
  }).catch(() => {});

  return FollowUp.findById(followup._id).populate(FOLLOWUP_POPULATE).lean();
}

async function updateFollowUpRecord({ followup, body, user } = {}) {
  const { action, remarks, scheduledAt, category, ...rest } = body;
  const prevStatus = followup.status;
  const prevScheduled = followup.scheduledAt;

  if (category && FOLLOWUP_CATEGORIES.includes(category)) {
    followup.category = category;
  }

  if (action === 'complete') {
    followup.status = 'completed';
    followup.completedAt = new Date();
    followup.outcome = remarks || followup.outcome;
    if (remarks) followup.notes = remarks;
  } else if (action === 'reschedule') {
    followup.status = 'pending';
    followup.completedAt = undefined;
    if (scheduledAt) followup.scheduledAt = new Date(scheduledAt);
    if (remarks) followup.notes = remarks;
  } else {
    Object.assign(followup, rest);
    if (body.status === 'completed' && !followup.completedAt) {
      followup.completedAt = new Date();
    }
    if (body.notes !== undefined) followup.notes = body.notes;
    if (body.priority) followup.priority = body.priority;
    if (body.outcome !== undefined) followup.outcome = body.outcome;
    if (body.scheduledAt) followup.scheduledAt = new Date(body.scheduledAt);
  }

  await followup.save();

  const lead = await Lead.findById(followup.lead);
  if (lead) {
    await applyCategoryToLead(lead, followup.category, followup.status, body);
    await syncLeadFollowUpDates(lead._id);
    if (
      (action === 'complete' || followup.status === 'completed') &&
      (followup.category === 'cold' || String(lead.coldCallFollowUpId) === String(followup._id))
    ) {
      lead.coldCallPending = false;
      lead.coldCallReminderAt = undefined;
      lead.coldCallFollowUpId = undefined;
      await lead.save();
    }
    if (action === 'reschedule') {
      await resolveMissedAlertsForLead(lead._id, followup._id);
    }
    if (action === 'complete') {
      notifyFollowUpOutcome(followup, lead).catch(() => {});
      if (followup.category === 'converted' && lead.status === 'converted') {
        await onLeadConverted(lead, user).catch((err) => {
          console.error('[LeadConversion]', err.message);
        });
      }
    }

    let activityType = null;
    let description = describeFollowUp(followup, body);
    if (action === 'complete' || (followup.status === 'completed' && prevStatus !== 'completed')) {
      activityType = 'followup_completed';
      description = `Follow-up completed${remarks || followup.outcome ? ` — ${remarks || followup.outcome}` : ''}`;
    } else if (action === 'reschedule' || (scheduledAt && String(prevScheduled) !== String(followup.scheduledAt))) {
      activityType = 'followup_rescheduled';
      description = `Follow-up rescheduled${followup.scheduledAt ? ` to ${new Date(followup.scheduledAt).toLocaleString('en-IN')}` : ''}${remarks ? ` — ${remarks}` : ''}`;
    } else if (action || body.notes !== undefined || body.outcome !== undefined || body.status) {
      activityType = 'followup_created';
      description = `Follow-up updated · ${description}`;
    }

    if (activityType) {
      await logLeadActivity({
        leadId: lead._id,
        branchId: lead.branchId,
        type: activityType,
        description,
        actor: user,
        meta: {
          followUpId: followup._id,
          action: action || 'update',
          category: followup.category,
          status: followup.status,
          scheduledAt: followup.scheduledAt,
        },
      }).catch(() => {});
    }
  }

  return FollowUp.findById(followup._id).populate(FOLLOWUP_POPULATE).lean();
}

module.exports = {
  createFollowUpForLead,
  updateFollowUpRecord,
};
