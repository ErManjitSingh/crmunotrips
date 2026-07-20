const mongoose = require('mongoose');

const EXIT_STATUSES = [
  'initiated',
  'notice_period',
  'clearance',
  'settlement',
  'completed',
  'withdrawn',
];

const hrExitCaseSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'HrEmployee', required: true },
    resignationDate: { type: Date, required: true },
    lastWorkingDate: { type: Date, default: null },
    noticePeriodDays: { type: Number, default: 30 },
    reason: { type: String, default: '' },
    status: { type: String, enum: EXIT_STATUSES, default: 'initiated' },
    assetReturned: { type: Boolean, default: false },
    clearanceDone: { type: Boolean, default: false },
    settlementDone: { type: Boolean, default: false },
    exitInterviewNotes: { type: String, default: '' },
    experienceLetterUrl: { type: String, default: '' },
    relievingLetterUrl: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

hrExitCaseSchema.index({ status: 1, isDeleted: 1, createdAt: -1 });
hrExitCaseSchema.index({ employeeId: 1, isDeleted: 1 });

module.exports = mongoose.model('HrExitCase', hrExitCaseSchema);
module.exports.EXIT_STATUSES = EXIT_STATUSES;
