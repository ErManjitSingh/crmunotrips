const mongoose = require('mongoose');

const componentSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    type: { type: String, enum: ['earning', 'deduction'], default: 'earning' },
    calcType: { type: String, enum: ['fixed', 'percent'], default: 'fixed' },
    amount: { type: Number, default: 0 },
    percentOf: { type: String, default: 'basic' },
  },
  { _id: false }
);

const hrSalaryStructureSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true, default: '' },
    description: { type: String, default: '' },
    components: { type: [componentSchema], default: [] },
    isDefault: { type: Boolean, default: false },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

hrSalaryStructureSchema.index({ status: 1, isDeleted: 1 });

module.exports = mongoose.model('HrSalaryStructure', hrSalaryStructureSchema);
