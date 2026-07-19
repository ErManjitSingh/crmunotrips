const mongoose = require('mongoose');

const whatsAppConversationSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, index: true },
    waId: { type: String, index: true },
    profileName: { type: String, default: '' },
    lastMessageText: { type: String, default: '' },
    lastMessageAt: { type: Date, default: Date.now, index: true },
    lastDirection: { type: String, enum: ['incoming', 'outgoing', null], default: null },
    unreadCount: { type: Number, default: 0 },
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', index: true, default: null },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', index: true },
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

whatsAppConversationSchema.index({ phone: 1 }, { unique: true });

module.exports = mongoose.model('WhatsAppConversation', whatsAppConversationSchema);
