const mongoose = require('mongoose');

const hrDepartmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true, default: '' },
    description: { type: String, default: '' },
    headId: { type: mongoose.Schema.Types.ObjectId, ref: 'HrEmployee', default: null },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

hrDepartmentSchema.index({ name: 1 });
hrDepartmentSchema.index({ status: 1, isDeleted: 1 });

module.exports = mongoose.model('HrDepartment', hrDepartmentSchema);
