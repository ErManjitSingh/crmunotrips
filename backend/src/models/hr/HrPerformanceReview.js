const mongoose = require('mongoose');

const PERIOD_TYPES = ['monthly', 'quarterly', 'yearly'];

const hrPerformanceReviewSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'HrEmployee', required: true },
    periodType: { type: String, enum: PERIOD_TYPES, default: 'quarterly' },
    periodLabel: { type: String, required: true, trim: true },
    rating: { type: Number, min: 1, max: 5, default: 3 },
    kpis: [
      {
        name: { type: String, default: '' },
        target: { type: String, default: '' },
        achievement: { type: String, default: '' },
        score: { type: Number, min: 1, max: 5, default: 3 },
      },
    ],
    achievements: { type: String, default: '' },
    managerFeedback: { type: String, default: '' },
    selfReview: { type: String, default: '' },
    peerFeedback: { type: String, default: '' },
    promotionSuggested: { type: Boolean, default: false },
    status: { type: String, enum: ['draft', 'submitted', 'completed'], default: 'draft' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

hrPerformanceReviewSchema.index({ employeeId: 1, isDeleted: 1, createdAt: -1 });
hrPerformanceReviewSchema.index({ periodType: 1, status: 1 });

module.exports = mongoose.model('HrPerformanceReview', hrPerformanceReviewSchema);
module.exports.PERIOD_TYPES = PERIOD_TYPES;
