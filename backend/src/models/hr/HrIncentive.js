const mongoose = require('mongoose');

const INCENTIVE_TYPES = ['sales', 'bonus', 'commission', 'referral', 'other'];
const INCENTIVE_STATUSES = ['pending', 'approved', 'paid', 'rejected'];

const hrIncentiveSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'HrEmployee', required: true },
    type: { type: String, enum: INCENTIVE_TYPES, default: 'bonus' },
    title: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    periodLabel: { type: String, default: '' },
    status: { type: String, enum: INCENTIVE_STATUSES, default: 'pending' },
    notes: { type: String, default: '' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

hrIncentiveSchema.index({ status: 1, isDeleted: 1, createdAt: -1 });
hrIncentiveSchema.index({ employeeId: 1, isDeleted: 1 });

module.exports = mongoose.model('HrIncentive', hrIncentiveSchema);
module.exports.INCENTIVE_TYPES = INCENTIVE_TYPES;
module.exports.INCENTIVE_STATUSES = INCENTIVE_STATUSES;
