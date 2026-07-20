const mongoose = require('mongoose');

const hrDesignationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true, default: '' },
    level: { type: Number, default: 1 },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'HrDepartment', default: null },
    description: { type: String, default: '' },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

hrDesignationSchema.index({ name: 1 });
hrDesignationSchema.index({ departmentId: 1, isDeleted: 1 });

module.exports = mongoose.model('HrDesignation', hrDesignationSchema);
