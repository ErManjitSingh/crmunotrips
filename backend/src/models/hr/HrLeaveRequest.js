const mongoose = require('mongoose');

const LEAVE_TYPES = [
  'casual',
  'sick',
  'earned',
  'maternity',
  'paternity',
  'comp_off',
  'unpaid',
];
const LEAVE_STATUSES = ['pending', 'manager_approved', 'approved', 'rejected', 'cancelled'];

const hrLeaveRequestSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'HrEmployee', required: true, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
    leaveType: { type: String, enum: LEAVE_TYPES, required: true },
    fromDate: { type: Date, required: true },
    toDate: { type: Date, required: true },
    days: { type: Number, default: 1 },
    reason: { type: String, default: '' },
    status: { type: String, enum: LEAVE_STATUSES, default: 'pending' },
    comments: { type: String, default: '' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

hrLeaveRequestSchema.index({ status: 1, fromDate: -1 });
hrLeaveRequestSchema.index({ leaveType: 1, status: 1 });

module.exports = mongoose.model('HrLeaveRequest', hrLeaveRequestSchema);
module.exports.LEAVE_TYPES = LEAVE_TYPES;
module.exports.LEAVE_STATUSES = LEAVE_STATUSES;
