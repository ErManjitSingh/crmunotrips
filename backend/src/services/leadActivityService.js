const LeadActivity = require('../models/LeadActivity');

const ACTIVITY_TITLES = {
  lead_created: 'Lead Created',
  lead_assigned: 'Lead Assigned',
  lead_reassigned: 'Lead Reassigned',
  lead_transferred: 'Lead Transferred',
  lead_merged: 'Lead Merged',
  call_made: 'Call Made',
  whatsapp_sent: 'WhatsApp Sent',
  whatsapp_contact_initiated: 'WhatsApp Contact Initiated',
  email_sent: 'Email Sent',
  followup_created: 'Follow-up Created',
  followup_completed: 'Follow-up Completed',
  followup_missed: 'Follow-up Missed',
  quotation_created: 'Quotation Created',
  quotation_submitted: 'Quotation Submitted',
  quotation_sent: 'Quotation Sent',
  quotation_approved: 'Quotation Approved',
  quotation_rejected: 'Quotation Rejected',
  status_changed: 'Status Changed',
  lead_edited: 'Lead Edited',
  lead_lost: 'Lead Lost',
  lead_reactivated: 'Lead Reactivated',
  lead_converted: 'Lead Converted',
  lead_deleted: 'Lead Deleted',
  lead_restored: 'Lead Restored',
  note_added: 'Note Added',
  call_note_added: 'Call Note Added',
  sla_breached: 'SLA Breached',
  escalation_created: 'Escalation Created',
};

async function logLeadActivity({
  leadId,
  branchId,
  type,
  title,
  description = '',
  actor,
  meta = {},
}) {
  if (!leadId || !type) return null;
  return LeadActivity.create({
    leadId,
    branchId: branchId || null,
    type,
    title: title || ACTIVITY_TITLES[type] || type,
    description,
    actorId: actor?._id || actor?.id || null,
    actorName: actor?.name || 'System',
    meta,
  });
}

const { clampLimit, DETAIL_MAX_LIMIT } = require('../utils/pagination');

async function getLeadTimeline(leadId, { page = 1, limit = 50 } = {}) {
  const lim = clampLimit(limit, { defaultLimit: 20, maxLimit: DETAIL_MAX_LIMIT });
  const skip = (Math.max(1, page) - 1) * lim;
  const filter = { leadId };
  const [data, total] = await Promise.all([
    LeadActivity.find(filter).sort({ createdAt: -1 }).skip(skip).limit(lim).lean(),
    LeadActivity.countDocuments(filter),
  ]);
  return {
    data: data.map((a) => ({
      id: a._id,
      type: a.type,
      title: a.title,
      description: a.description,
      user: a.actorName,
      date: a.createdAt,
      notes: a.description,
      meta: a.meta,
    })),
    pagination: { page, limit: lim, total, totalPages: Math.ceil(total / lim) || 0 },
  };
}

module.exports = { logLeadActivity, getLeadTimeline, ACTIVITY_TITLES };
