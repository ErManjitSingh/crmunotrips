const mongoose = require('mongoose');

const monthlySalesTargetSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', index: true },
    year: { type: Number, required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    /** Primary ₹ target (UI: Target) — used by dashboard progress */
    revenueTarget: { type: Number, required: true, min: 0, default: 0 },
    /** Package total ₹ target (quotation package total) */
    packageTarget: { type: Number, min: 0, default: 0 },
    /** Total sales ₹ target */
    totalSalesTarget: { type: Number, min: 0, default: 0 },
    /** Profit ₹ target */
    profitTarget: { type: Number, min: 0, default: 0 },
    /** How the setter entered values: monthly totals or per-day amounts */
    periodType: { type: String, enum: ['monthly', 'daily'], default: 'monthly' },
    /** Working days used when periodType is daily (monthly = daily × workingDays) */
    workingDays: { type: Number, min: 1, max: 31, default: 26 },
    setBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    setByName: { type: String, trim: true },
    notes: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

monthlySalesTargetSchema.index({ userId: 1, year: 1, month: 1 }, { unique: true });
monthlySalesTargetSchema.index({ branchId: 1, year: 1, month: 1 });

module.exports = mongoose.model('MonthlySalesTarget', monthlySalesTargetSchema);
