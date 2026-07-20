const mongoose = require('mongoose');

const JOB_STATUSES = ['open', 'on_hold', 'closed', 'filled'];

const hrJobOpeningSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'HrDepartment', default: null },
    designationId: { type: mongoose.Schema.Types.ObjectId, ref: 'HrDesignation', default: null },
    openings: { type: Number, default: 1, min: 1 },
    location: { type: String, default: '' },
    employmentType: {
      type: String,
      enum: ['full_time', 'part_time', 'contract', 'intern'],
      default: 'full_time',
    },
    description: { type: String, default: '' },
    requirements: { type: String, default: '' },
    status: { type: String, enum: JOB_STATUSES, default: 'open' },
    postedAt: { type: Date, default: Date.now },
    closedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

hrJobOpeningSchema.index({ status: 1, isDeleted: 1, createdAt: -1 });

module.exports = mongoose.model('HrJobOpening', hrJobOpeningSchema);
module.exports.JOB_STATUSES = JOB_STATUSES;
