const mongoose = require('mongoose');

const slipSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'HrEmployee', required: true },
    employeeCode: { type: String, default: '' },
    name: { type: String, default: '' },
    department: { type: String, default: '' },
    designation: { type: String, default: '' },
    basic: { type: Number, default: 0 },
    allowances: { type: Number, default: 0 },
    bonuses: { type: Number, default: 0 },
    incentives: { type: Number, default: 0 },
    deductions: { type: Number, default: 0 },
    tax: { type: Number, default: 0 },
    pf: { type: Number, default: 0 },
    esic: { type: Number, default: 0 },
    advance: { type: Number, default: 0 },
    loans: { type: Number, default: 0 },
    gross: { type: Number, default: 0 },
    net: { type: Number, default: 0 },
    components: [
      {
        key: String,
        label: String,
        type: { type: String, enum: ['earning', 'deduction'] },
        amount: Number,
      },
    ],
  },
  { _id: false }
);

const hrPayrollRunSchema = new mongoose.Schema(
  {
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
    status: {
      type: String,
      enum: ['draft', 'processing', 'processed', 'paid'],
      default: 'draft',
    },
    slips: { type: [slipSchema], default: [] },
    totals: {
      employees: { type: Number, default: 0 },
      gross: { type: Number, default: 0 },
      deductions: { type: Number, default: 0 },
      net: { type: Number, default: 0 },
    },
    notes: { type: String, default: '' },
    processedAt: { type: Date, default: null },
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

hrPayrollRunSchema.index({ year: -1, month: -1, isDeleted: 1 });
hrPayrollRunSchema.index({ status: 1, isDeleted: 1 });

module.exports = mongoose.model('HrPayrollRun', hrPayrollRunSchema);
