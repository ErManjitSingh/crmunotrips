const mongoose = require('mongoose');

const WORK_MODES = ['office', 'wfh'];
const STATUSES = ['present', 'late', 'absent'];

const sessionSchema = new mongoose.Schema(
  {
    checkIn: { type: Date, required: true },
    checkOut: { type: Date, required: true },
    totalHours: { type: Number, default: null },
    isAutoCheckout: { type: Boolean, default: false },
  },
  { _id: false }
);

const attendanceSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', index: true },
    date: { type: Date, required: true, index: true },
    checkIn: { type: Date, required: true },
    checkOut: { type: Date, default: null },
    totalHours: { type: Number, default: null },
    workMode: { type: String, enum: WORK_MODES, required: true },
    status: { type: String, enum: STATUSES, required: true },
    isAutoCheckout: { type: Boolean, default: false },
    /** Closed sessions earlier the same day (e.g. morning shift before 6:20 PM auto-logout). */
    sessions: { type: [sessionSchema], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

attendanceSchema.index({ userId: 1, date: 1 }, { unique: true });
attendanceSchema.index({ date: 1, workMode: 1 });
attendanceSchema.index({ date: 1, status: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
module.exports.WORK_MODES = WORK_MODES;
module.exports.STATUSES = STATUSES;
