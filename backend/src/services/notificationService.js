const Notification = require('../models/Notification');
const User = require('../models/User');
const { NOTIFICATIONS_ENABLED } = require('../config/notifications');
const { getIO } = require('../config/socket');
const { formatNotification } = require('../utils/queryHelpers');
const { NOTIFICATION_TYPES: T } = require('../constants/notificationTypes');

async function emitUnreadCount(userId) {
  const io = getIO();
  if (!io || !userId) return;
  const count = await Notification.countDocuments({ user: userId, read: false });
  io.to(`user:${userId}`).emit('notification:unread', { count });
}

async function notifyUser(userId, payload) {
  if (!NOTIFICATIONS_ENABLED || !userId) return null;
  const id = userId._id || userId;

  const doc = await Notification.create({
    user: id,
    branchId: payload.branchId || payload.meta?.branchId || null,
    type: payload.type,
    title: payload.title,
    message: payload.message,
    meta: payload.meta || {},
  });

  const formatted = formatNotification(doc);
  const io = getIO();
  if (io) {
    io.to(`user:${id}`).emit('notification:new', formatted);
    await emitUnreadCount(id);
  }
  return formatted;
}

async function notifyUsers(userIds, payload) {
  const unique = [...new Set(userIds.map((u) => (u?._id || u)?.toString()).filter(Boolean))];
  return Promise.all(unique.map((uid) => notifyUser(uid, payload)));
}

async function getActiveUserIdsByRoles(roles) {
  const users = await User.find({ role: { $in: roles }, status: 'active' }).select('_id').lean();
  return users.map((u) => u._id);
}

async function getActiveUserIdsByRolesInBranch(roles, branchId) {
  const users = await User.find({
    role: { $in: roles },
    status: 'active',
    ...(branchId ? { branchId } : {}),
  })
    .select('_id')
    .lean();
  return users.map((u) => u._id);
}

async function getAdminUserIds() {
  return getActiveUserIdsByRoles(['admin']);
}

async function notifyLeadCreated(lead, createdBy) {
  const assigneeId = lead.assignedTo?._id || lead.assignedTo;
  const creatorId = createdBy?._id?.toString() || createdBy?.toString();
  const recipients = [];

  if (assigneeId && assigneeId.toString() !== creatorId) {
    recipients.push(assigneeId);
  }

  const [admins, managers] = await Promise.all([
    getAdminUserIds(),
    getActiveUserIdsByRoles(['sales_manager']),
  ]);

  // Admins always get new-lead alerts (including when they create leads themselves)
  admins.forEach((id) => recipients.push(id));

  managers.forEach((id) => {
    if (id.toString() !== creatorId) recipients.push(id);
  });

  const name = lead.name || lead.leadId || 'New lead';
  await notifyUsers(recipients, {
    branchId: lead.branchId,
    type: T.LEAD_CREATED,
    title: 'New lead created',
    message: `${name} has been added to the CRM`,
    meta: { leadId: lead._id, href: `/leads/${lead._id}` },
  });
}

async function notifyLeadAssigned({ assigneeId, assigneeName, leadIds, leadNames, assignedBy }) {
  if (!assigneeId) return;
  const by = assignedBy?.name || 'Someone';
  const count = leadIds?.length || 1;
  const label = leadNames?.[0] || `${count} lead(s)`;
  const assigneeStr = (assigneeId._id || assigneeId).toString();
  const assignerStr = assignedBy?._id?.toString() || assignedBy?.toString();

  await notifyUser(assigneeId, {
    branchId: assignedBy?.branchId || null,
    type: T.LEAD_ASSIGNED,
    title: 'Lead assigned to you',
    message:
      count === 1
        ? `${by} assigned ${label} to you`
        : `${by} assigned ${count} leads to you`,
    meta: {
      leadId: leadIds?.[0],
      leadIds,
      href: leadIds?.[0] ? `/leads/${leadIds[0]}` : undefined,
    },
  });

  const admins = await getAdminUserIds();
  const oversightMessage =
    count === 1
      ? `${by} assigned ${label} to ${assigneeName}`
      : `${by} assigned ${count} leads to ${assigneeName}`;

  await notifyUsers(
    admins.filter((id) => id.toString() !== assigneeStr && id.toString() !== assignerStr),
    {
      branchId: assignedBy?.branchId || null,
      type: T.LEAD_ASSIGNED,
      title: 'Lead assigned',
      message: oversightMessage,
      meta: {
        leadId: leadIds?.[0],
        leadIds,
        href: leadIds?.[0] ? `/leads/${leadIds[0]}` : undefined,
      },
    }
  );
}

async function notifyLeadReactivated({ lead, actor, assigneeId }) {
  const branchId = lead?.branchId || actor?.branchId || null;
  const recipients = await getActiveUserIdsByRolesInBranch(
    ['admin', 'sales_manager', 'team_leader'],
    branchId
  );
  if (assigneeId) recipients.push(assigneeId);

  const actorName = actor?.name || 'System';
  await notifyUsers(recipients, {
    branchId,
    type: T.LEAD_REACTIVATED,
    title: 'Lead reactivated',
    message: `${lead?.name || 'Lead'} was reactivated by ${actorName}`,
    meta: { leadId: lead?._id, href: lead?._id ? `/leads/${lead._id}` : undefined },
  });
}

async function notifyLeadReassigned({ lead, actor, assigneeId, assigneeName }) {
  if (!lead?._id || !assigneeId) return;
  const branchId = lead.branchId || actor?.branchId || null;
  const recipients = await getActiveUserIdsByRolesInBranch(
    ['admin', 'sales_manager', 'team_leader'],
    branchId
  );
  recipients.push(assigneeId);

  await notifyUsers(recipients, {
    branchId,
    type: T.LEAD_REASSIGNED,
    title: 'Reactivated lead reassigned',
    message: `${lead.name} is reassigned to ${assigneeName || 'an executive'}`,
    meta: { leadId: lead._id, href: `/leads/${lead._id}` },
  });
}

async function notifyReactivationProgress({ lead, actor, stage }) {
  if (!lead?._id || !stage) return;
  const branchId = lead.branchId || actor?.branchId || null;
  const recipients = await getActiveUserIdsByRolesInBranch(
    ['admin', 'sales_manager', 'team_leader'],
    branchId
  );

  await notifyUsers(recipients, {
    branchId,
    type: T.LEAD_REACTIVATION_PROGRESS,
    title: 'Reactivation progress updated',
    message: `${lead.name} moved to ${stage.replace(/_/g, ' ')}`,
    meta: { leadId: lead._id, stage, href: `/leads/${lead._id}` },
  });
}

async function notifyFollowUpReminder(followUp, lead) {
  const userId = followUp.assignedTo?._id || followUp.assignedTo || lead?.assignedTo?._id || lead?.assignedTo;

  const when = new Date(followUp.scheduledAt).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const payload = {
    branchId: lead?.branchId || null,
    type: T.FOLLOWUP_REMINDER,
    title: 'Follow-up reminder',
    message: `Follow-up with ${lead?.name || 'customer'} scheduled at ${when}`,
    meta: {
      followUpId: followUp._id,
      leadId: lead?._id,
      leadName: lead?.name,
      category: followUp.category || 'warm',
      leadStatus: lead?.status,
      href: lead?._id ? `/leads/${lead._id}` : undefined,
    },
  };

  if (userId) {
    await notifyUser(userId, payload);
    return;
  }

  const managers = await getActiveUserIdsByRolesInBranch(['sales_manager', 'team_leader'], lead?.branchId);
  await notifyUsers(managers.length ? managers : await getActiveUserIdsByRoles(['sales_manager']), {
    ...payload,
    title: 'Follow-up reminder (unassigned lead)',
    message: `Unassigned lead ${lead?.name || 'customer'} has a follow-up at ${when}`,
  });
}

async function notifySlaBreach(lead) {
  if (!lead?._id) return;
  const branchId = lead.branchId || null;
  const recipients = await getActiveUserIdsByRolesInBranch(
    ['admin', 'sales_manager', 'team_leader'],
    branchId
  );
  if (lead.assignedTo) recipients.push(lead.assignedTo?._id || lead.assignedTo);

  await notifyUsers(recipients, {
    branchId,
    type: T.LEAD_SLA_BREACH,
    title: 'Lead first-call SLA breached',
    message: `${lead.name}: ${lead._slaLabel || 'first contact SLA missed'}`,
    meta: {
      leadId: lead._id,
      href: `/leads/${lead._id}`,
      persistent: true,
    },
  });
}

async function notifyLeadMerged({ target, source, actor }) {
  if (!target?._id) return;
  const branchId = target.branchId || actor?.branchId || null;
  const recipients = await getActiveUserIdsByRolesInBranch(
    ['admin', 'sales_manager', 'team_leader'],
    branchId
  );
  if (target.assignedTo) recipients.push(target.assignedTo);

  await notifyUsers(recipients, {
    branchId,
    type: T.LEAD_MERGED,
    title: 'Duplicate lead merged',
    message: `${source?.name || 'Lead'} merged into ${target.name} by ${actor?.name || 'user'}`,
    meta: {
      leadId: target._id,
      sourceLeadId: source?._id,
      href: `/leads/${target._id}`,
    },
  });
}

async function notifyFollowUpEscalation({ followUp, lead, level, minutesOverdue, notifyRoles = [] }) {
  const branchId = followUp?.branchId || lead?.branchId || null;
  const recipients = await getActiveUserIdsByRolesInBranch(notifyRoles, branchId);
  const execId = followUp?.assignedTo?._id || followUp?.assignedTo;
  if (execId) recipients.push(execId);

  const levelLabel = { '15m': '15 min', '30m': '30 min', '1h': '1 hour' }[level] || level;

  await notifyUsers(recipients, {
    branchId,
    type: T.FOLLOWUP_ESCALATION,
    title: `Follow-up escalation (${levelLabel})`,
    message: `${lead?.name || 'Lead'} follow-up overdue by ${minutesOverdue} min — executive: ${followUp?.assignedTo?.name || 'Unassigned'}`,
    meta: {
      followUpId: followUp?._id,
      leadId: lead?._id || lead,
      leadName: lead?.name,
      category: followUp?.category || 'warm',
      leadStatus: lead?.status,
      executiveName: followUp?.assignedTo?.name,
      level,
      minutesOverdue,
      href: lead?._id ? `/leads/${lead._id}` : '/reminders',
      persistent: true,
    },
  });
}

function buildFollowUpNotificationMeta(followUp, lead) {
  const execName = followUp.assignedTo?.name || 'Unassigned';
  return {
    followUpId: followUp._id,
    leadId: lead?._id,
    leadName: lead?.name,
    category: followUp.category || 'warm',
    leadStatus: lead?.status,
    executiveName: execName,
    href: lead?._id ? `/leads/${lead._id}` : undefined,
    resolved: false,
    persistent: true,
  };
}

async function notifyFollowUpMissed(followUp, lead) {
  const execId = followUp.assignedTo?._id || followUp.assignedTo || lead?.assignedTo?._id || lead?.assignedTo;
  const branchId = lead?.branchId || followUp.branchId || null;
  const leadName = lead?.name || 'customer';
  const execName = followUp.assignedTo?.name || 'Unassigned';
  const meta = buildFollowUpNotificationMeta(followUp, lead);

  if (execId) {
    await notifyUser(execId, {
      branchId,
      type: T.FOLLOWUP_MISSED,
      title: 'Follow-up missed',
      message: `Missed follow-up for ${leadName} (${meta.category} lead). Please reschedule.`,
      meta,
    });
  }

  const oversightIds = await getActiveUserIdsByRolesInBranch(['sales_manager', 'team_leader'], branchId);
  const managers = oversightIds.filter((id) => id.toString() !== execId?.toString());

  if (managers.length) {
    await notifyUsers(managers, {
      branchId,
      type: T.FOLLOWUP_MISSED,
      title: 'Team follow-up missed',
      message: `${leadName} — missed by ${execName}. Category: ${meta.category}.`,
      meta: { ...meta, oversight: true },
    });
    return;
  }

  if (!execId) {
    const fallbackManagers = await getActiveUserIdsByRoles(['sales_manager']);
    await notifyUsers(fallbackManagers, {
      branchId,
      type: T.FOLLOWUP_MISSED,
      title: 'Follow-up missed (unassigned lead)',
      message: `Unassigned lead ${leadName} missed follow-up. Please assign and reschedule.`,
      meta,
    });
  }
}

async function notifyFollowUpOutcome(followUp, lead) {
  const category = followUp.category;
  if (!category || !['warm', 'converted', 'expected_conv', 'cold'].includes(category)) return;

  const branchId = lead?.branchId || followUp.branchId || null;
  const leadName = lead?.name || 'Lead';
  const categoryLabels = {
    warm: 'Warm Lead',
    cold: 'Cold Lead',
    converted: 'Converted Lead',
    expected_conv: 'Expected Conversion',
  };
  const label = categoryLabels[category] || category;

  const recipients = [];
  const execId = followUp.assignedTo?._id || followUp.assignedTo || lead?.assignedTo?._id || lead?.assignedTo;
  if (execId) recipients.push(execId);

  const oversight = await getActiveUserIdsByRolesInBranch(['sales_manager', 'team_leader'], branchId);
  oversight.forEach((id) => {
    if (!recipients.some((r) => r.toString() === id.toString())) recipients.push(id);
  });

  await notifyUsers(recipients, {
    branchId,
    type: T.FOLLOWUP_OUTCOME,
    title: label,
    message: `${leadName} marked as ${label} after follow-up completion.`,
    meta: {
      followUpId: followUp._id,
      leadId: lead?._id,
      leadName,
      category,
      leadStatus: lead?.status,
      href: lead?._id ? `/leads/${lead._id}` : undefined,
    },
  });
}

async function notifyQuotationCreated(quotation, lead, { approverIds = [] } = {}) {
  const quoteNo = quotation.quoteNumber || 'Quotation';
  const leadName = lead?.name || 'customer';
  const executiveId = quotation.createdByExecutive?._id || quotation.createdByExecutive;

  const recipients = [...approverIds];
  if (quotation.teamLeader) recipients.push(quotation.teamLeader);

  const managers = await getActiveUserIdsByRoles(['sales_manager', 'admin']);
  managers.forEach((id) => recipients.push(id));

  const filtered = recipients.filter(
    (id) => id && id.toString() !== executiveId?.toString()
  );

  await notifyUsers(filtered, {
    branchId: lead?.branchId || quotation.branchId || null,
    type: T.QUOTATION_CREATED,
    title: 'Quotation pending approval',
    message: `${quoteNo} for ${leadName} needs your review`,
    meta: { quotationId: quotation._id, leadId: lead?._id },
  });
}

async function notifyQuotationApproved(quotation, lead, approvedBy) {
  const executiveId = quotation.createdByExecutive?._id || quotation.createdByExecutive || quotation.createdBy;
  if (!executiveId) return;

  await notifyUser(executiveId, {
    branchId: lead?.branchId || quotation.branchId || null,
    type: T.QUOTATION_APPROVED,
    title: 'Quotation approved',
    message: `${quotation.quoteNumber || 'Quote'} for ${lead?.name || 'customer'} was approved by ${approvedBy?.name || 'manager'}`,
    meta: { quotationId: quotation._id, leadId: lead?._id },
  });
}

async function notifyQuotationRejected(quotation, lead, rejectedBy) {
  const executiveId = quotation.createdByExecutive?._id || quotation.createdByExecutive || quotation.createdBy;
  if (!executiveId) return;

  await notifyUser(executiveId, {
    branchId: lead?.branchId || quotation.branchId || null,
    type: T.QUOTATION_REJECTED,
    title: 'Quotation rejected',
    message: `${quotation.quoteNumber || 'Quote'} for ${lead?.name || 'customer'} was rejected by ${rejectedBy?.name || 'manager'}`,
    meta: { quotationId: quotation._id, leadId: lead?._id },
  });
}

async function notifyBookingConfirmed(booking, { notifyUserIds = [] } = {}) {
  const recipients = [...notifyUserIds];
  if (booking.assignedTo) recipients.push(booking.assignedTo);

  await notifyUsers(recipients, {
    branchId: booking.branchId || null,
    type: T.BOOKING_CONFIRMED,
    title: 'Booking confirmed',
    message: `Booking ${booking.bookingNumber || ''} for ${booking.customerName || 'customer'} is confirmed`,
    meta: { bookingId: booking._id },
  });
}

async function notifyPaymentReceived(payment, { notifyUserIds = [] } = {}) {
  const amount = payment.amount ?? payment.paidAmount;
  const label = payment.booking?.bookingNumber || payment.reference || 'Payment';

  const accountants = await getActiveUserIdsByRoles(['accountant', 'admin']);
  const recipients = [...notifyUserIds, ...accountants];

  await notifyUsers(recipients, {
    branchId: payment.branchId || null,
    type: T.PAYMENT_RECEIVED,
    title: 'Payment received',
    message: `₹${Number(amount || 0).toLocaleString('en-IN')} received — ${label}`,
    meta: { paymentId: payment._id, bookingId: payment.booking?._id || payment.booking },
  });
}

async function notifyUserMentioned({ mentionedUserId, mentionedBy, context, text, meta = {} }) {
  if (!mentionedUserId) return;
  const by = mentionedBy?.name || 'Someone';

  await notifyUser(mentionedUserId, {
    branchId: meta.branchId || null,
    type: T.USER_MENTIONED,
    title: 'You were mentioned',
    message: `${by} mentioned you${context ? ` in ${context}` : ''}: "${(text || '').slice(0, 120)}"`,
    meta,
  });
}

async function parseAndNotifyMentions(text, mentionedBy, context, meta = {}) {
  const bodyMentions = meta.mentionIds || [];
  if (bodyMentions.length) {
    await notifyUsers(bodyMentions, {
      branchId: meta.branchId || null,
      type: T.USER_MENTIONED,
      title: 'You were mentioned',
      message: `${mentionedBy?.name || 'Someone'} mentioned you${context ? ` in ${context}` : ''}`,
      meta,
    });
    return;
  }

  const matches = [...(text || '').matchAll(/@\[([a-f\d]{24})\]/gi)];
  const ids = matches.map((m) => m[1]);
  if (!ids.length) return;

  await notifyUsers(ids, {
    branchId: meta.branchId || null,
    type: T.USER_MENTIONED,
    title: 'You were mentioned',
    message: `${mentionedBy?.name || 'Someone'} mentioned you${context ? ` in ${context}` : ''}: "${text.slice(0, 100)}"`,
    meta,
  });
}

async function notifyLeadAcceptMissed({ lead, executiveId, executiveName }) {
  if (!executiveId) return;
  const name = lead?.name || 'Lead';
  await notifyUser(executiveId, {
    branchId: lead?.branchId || null,
    type: T.LEAD_ACCEPT_MISSED,
    title: 'Lead returned to pool',
    message: `"${name}" was not accepted within 2 minutes — the lead was returned to the unassigned pool`,
    meta: {
      leadId: lead?._id,
      href: '/sales-executive/leads/all',
      returnedToPool: true,
    },
  });
}

module.exports = {
  notifyUser,
  notifyUsers,
  emitUnreadCount,
  notifyLeadCreated,
  notifyLeadAssigned,
  notifyLeadReactivated,
  notifyLeadReassigned,
  notifyLeadAcceptMissed,
  notifyReactivationProgress,
  notifyFollowUpReminder,
  notifyFollowUpMissed,
  notifyFollowUpOutcome,
  notifyFollowUpEscalation,
  notifyLeadMerged,
  notifySlaBreach,
  notifyQuotationCreated,
  notifyQuotationApproved,
  notifyQuotationRejected,
  notifyBookingConfirmed,
  notifyPaymentReceived,
  notifyUserMentioned,
  parseAndNotifyMentions,
  NOTIFICATION_TYPES: T,
};
