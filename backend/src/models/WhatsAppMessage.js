const mongoose = require('mongoose');

const whatsAppMessageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WhatsAppConversation',
      index: true,
    },
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', index: true },
    waMessageId: { type: String, index: true, sparse: true },
    fromPhone: { type: String, default: '' },
    direction: { type: String, enum: ['incoming', 'outgoing'], required: true },
    type: { type: String, enum: ['text', 'image', 'document', 'audio', 'video', 'unknown'], default: 'text' },
    text: { type: String, default: '' },
    attachment: { type: mongoose.Schema.Types.Mixed },
    status: { type: String, enum: ['sent', 'delivered', 'read', 'failed', 'received'], default: 'sent' },
    timestamp: { type: Date, default: Date.now, index: true },
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

whatsAppMessageSchema.index({ conversation: 1, timestamp: 1 });
whatsAppMessageSchema.index({ lead: 1, timestamp: 1 });

module.exports = mongoose.model('WhatsAppMessage', whatsAppMessageSchema);
