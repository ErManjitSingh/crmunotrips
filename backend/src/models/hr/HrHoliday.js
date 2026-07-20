const mongoose = require('mongoose');

const HOLIDAY_TYPES = ['national', 'state', 'company', 'festival', 'custom'];

const hrHolidaySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    type: { type: String, enum: HOLIDAY_TYPES, default: 'company' },
    description: { type: String, default: '' },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
    isOptional: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

hrHolidaySchema.index({ date: 1, isDeleted: 1 });

module.exports = mongoose.model('HrHoliday', hrHolidaySchema);
module.exports.HOLIDAY_TYPES = HOLIDAY_TYPES;
