const mongoose = require('mongoose');

const whatsAppConversationSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true },
    waId: { type: String, index: true },
    profileName: { type: String, default: '' },
    lastMessageText: { type: String, default: '' },
    lastMessageAt: { type: Date, default: Date.now, index: true },
    lastDirection: { type: String, enum: ['incoming', 'outgoing', null], default: null },
    unreadCount: { type: Number, default: 0 },
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', index: true, default: null },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', index: true },
    isArchived: { type: Boolean, default: false },
    /** Auto Q&A bot: travel date → travelers */
    botEnabled: { type: Boolean, default: true },
    botStep: {
      type: String,
      enum: ['idle', 'await_travel_date', 'await_travelers', 'completed', 'paused'],
      default: 'idle',
    },
    botAnswers: {
      travelDateRaw: { type: String, default: '' },
      travelDate: { type: Date },
      travelersRaw: { type: String, default: '' },
      travelers: { type: Number },
      completedAt: { type: Date },
    },
  },
  { timestamps: true }
);

whatsAppConversationSchema.index({ phone: 1 }, { unique: true });
whatsAppConversationSchema.index({ isArchived: 1, lastMessageAt: -1 });
whatsAppConversationSchema.index({ lead: 1, lastMessageAt: -1 });
whatsAppConversationSchema.index({ branchId: 1, lastMessageAt: -1 });

module.exports = mongoose.model('WhatsAppConversation', whatsAppConversationSchema);
