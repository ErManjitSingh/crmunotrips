const mongoose = require('mongoose');

const hrTrainingCourseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    category: { type: String, default: 'general' },
    description: { type: String, default: '' },
    videoUrl: { type: String, default: '' },
    durationHours: { type: Number, default: 1 },
    status: { type: String, enum: ['active', 'archived'], default: 'active' },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

hrTrainingCourseSchema.index({ status: 1, isDeleted: 1 });

module.exports = mongoose.model('HrTrainingCourse', hrTrainingCourseSchema);
