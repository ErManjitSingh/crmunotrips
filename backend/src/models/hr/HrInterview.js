const mongoose = require('mongoose');

const INTERVIEW_STATUSES = ['scheduled', 'completed', 'cancelled', 'no_show'];
const MODES = ['in_person', 'video', 'phone'];

const hrInterviewSchema = new mongoose.Schema(
  {
    candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'HrCandidate', required: true },
    jobOpeningId: { type: mongoose.Schema.Types.ObjectId, ref: 'HrJobOpening', default: null },
    round: { type: String, default: 'Round 1' },
    scheduledAt: { type: Date, required: true },
    interviewer: { type: String, default: '' },
    mode: { type: String, enum: MODES, default: 'video' },
    status: { type: String, enum: INTERVIEW_STATUSES, default: 'scheduled' },
    rating: { type: Number, min: 1, max: 5, default: null },
    feedback: { type: String, default: '' },
    recommendation: {
      type: String,
      enum: ['strong_hire', 'hire', 'maybe', 'no_hire', ''],
      default: '',
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

hrInterviewSchema.index({ scheduledAt: 1, status: 1, isDeleted: 1 });
hrInterviewSchema.index({ candidateId: 1, isDeleted: 1 });

module.exports = mongoose.model('HrInterview', hrInterviewSchema);
module.exports.INTERVIEW_STATUSES = INTERVIEW_STATUSES;
module.exports.MODES = MODES;
