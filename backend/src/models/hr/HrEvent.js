const mongoose = require('mongoose');

const EVENT_TYPES = ['company', 'birthday', 'achievement', 'office', 'policy', 'townhall', 'other'];

const hrEventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    type: { type: String, enum: EVENT_TYPES, default: 'company' },
    description: { type: String, default: '' },
    location: { type: String, default: '' },
    startAt: { type: Date, required: true },
    endAt: { type: Date, default: null },
    isAllDay: { type: Boolean, default: false },
    status: { type: String, enum: ['upcoming', 'ongoing', 'completed', 'cancelled'], default: 'upcoming' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

hrEventSchema.index({ startAt: 1, isDeleted: 1 });
hrEventSchema.index({ status: 1, isDeleted: 1 });

module.exports = mongoose.model('HrEvent', hrEventSchema);
module.exports.EVENT_TYPES = EVENT_TYPES;
