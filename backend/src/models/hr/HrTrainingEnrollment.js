const mongoose = require('mongoose');

const hrTrainingEnrollmentSchema = new mongoose.Schema(
  {
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'HrTrainingCourse', required: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'HrEmployee', required: true },
    progressPct: { type: Number, min: 0, max: 100, default: 0 },
    status: { type: String, enum: ['enrolled', 'in_progress', 'completed'], default: 'enrolled' },
    certificateUrl: { type: String, default: '' },
    completedAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

hrTrainingEnrollmentSchema.index({ employeeId: 1, courseId: 1, isDeleted: 1 });
hrTrainingEnrollmentSchema.index({ status: 1, isDeleted: 1 });

module.exports = mongoose.model('HrTrainingEnrollment', hrTrainingEnrollmentSchema);
