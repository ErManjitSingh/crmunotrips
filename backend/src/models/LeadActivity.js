const mongoose = require('mongoose');

const LEAD_ACTIVITY_TYPES = [
  'lead_created',
  'lead_assigned',
  'lead_accepted',
  'lead_accept_expired',
  'lead_reassigned',
  'lead_transferred',
  'call_made',
  'whatsapp_sent',
  'whatsapp_contact_initiated',
  'email_sent',
  'followup_created',
  'followup_completed',
  'followup_missed',
  'quotation_created',
  'quotation_submitted',
  'quotation_sent',
  'quotation_approved',
  'quotation_rejected',
  'status_changed',
  'lead_edited',
  'lead_lost',
  'lead_reactivated',
  'lead_converted',
  'lead_merged',
  'lead_deleted',
  'lead_restored',
  'note_added',
  'call_note_added',
  'sla_breached',
  'escalation_created',
];

const leadActivitySchema = new mongoose.Schema(
  {
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', index: true },
    type: { type: String, enum: LEAD_ACTIVITY_TYPES, required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actorName: { type: String, trim: true, default: 'System' },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

leadActivitySchema.index({ leadId: 1, createdAt: -1 });
leadActivitySchema.index({ branchId: 1, createdAt: -1 });

module.exports = mongoose.model('LeadActivity', leadActivitySchema);
module.exports.LEAD_ACTIVITY_TYPES = LEAD_ACTIVITY_TYPES;
