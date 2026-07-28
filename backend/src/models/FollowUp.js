const mongoose = require('mongoose');

const followUpSchema = new mongoose.Schema(
  {
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', index: true },
    type: {
      type: String,
      enum: ['call', 'email', 'meeting', 'whatsapp', 'other'],
      default: 'call',
    },
    scheduledAt: { type: Date, required: true, index: true },
    completedAt: { type: Date },
    status: {
      type: String,
      enum: ['pending', 'completed', 'missed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    outcome: { type: String, default: '' },
    notes: { type: String, default: '' },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
    },
    category: {
      type: String,
      enum: [
        'call_picked',
        'call_not_picked',
        'dead_lead',
        'cold',
        'warm',
        'converted',
        'expected_conv',
      ],
      default: 'call_picked',
      index: true,
    },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

followUpSchema.index({ lead: 1, scheduledAt: -1 });
followUpSchema.index({ status: 1, scheduledAt: 1 });
followUpSchema.index({ branchId: 1, assignedTo: 1, status: 1, scheduledAt: 1 });

module.exports = mongoose.model('FollowUp', followUpSchema);
