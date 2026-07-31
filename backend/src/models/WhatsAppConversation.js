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
    /** Auto Q&A: destination → travel date → adults → best call time */
    botEnabled: { type: Boolean, default: true },
    botOptOut: { type: Boolean, default: false, index: true },
    botOptOutAt: { type: Date },
    botStep: {
      type: String,
      enum: [
        'idle',
        'await_destination',
        'await_travel_date',
        'await_adults',
        'await_best_time',
        'completed',
        'paused',
        // legacy steps (kept so old chats don't break)
        'await_travelers',
      ],
      default: 'idle',
    },
    botAnswers: {
      destinationRaw: { type: String, default: '' },
      destination: { type: String, default: '' },
      travelDateRaw: { type: String, default: '' },
      travelDate: { type: Date },
      travelersRaw: { type: String, default: '' },
      travelers: { type: Number },
      adultsRaw: { type: String, default: '' },
      adults: { type: Number },
      bestTimeRaw: { type: String, default: '' },
      bestTimeToCall: { type: String, default: '' },
      completedAt: { type: Date },
    },
    botSessionStartedAt: { type: Date },
    botLastSentAt: { type: Date },
    botSentCount: { type: Number, default: 0 },
    botReaskCount: { type: Number, default: 0 },
    botCompletedAt: { type: Date },
    botBlockedUntil: { type: Date },
  },
  { timestamps: true }
);

whatsAppConversationSchema.index({ phone: 1 }, { unique: true });
whatsAppConversationSchema.index({ isArchived: 1, lastMessageAt: -1 });
whatsAppConversationSchema.index({ lead: 1, lastMessageAt: -1 });
whatsAppConversationSchema.index({ branchId: 1, lastMessageAt: -1 });

module.exports = mongoose.model('WhatsAppConversation', whatsAppConversationSchema);
