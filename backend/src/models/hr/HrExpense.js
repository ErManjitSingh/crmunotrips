const mongoose = require('mongoose');

const EXPENSE_CATEGORIES = ['travel', 'hotel', 'food', 'fuel', 'office', 'other'];
const EXPENSE_STATUSES = ['pending', 'approved', 'rejected', 'reimbursed'];

const hrExpenseSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'HrEmployee', required: true },
    category: { type: String, enum: EXPENSE_CATEGORIES, default: 'other' },
    title: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    expenseDate: { type: Date, required: true },
    description: { type: String, default: '' },
    receiptUrl: { type: String, default: '' },
    status: { type: String, enum: EXPENSE_STATUSES, default: 'pending' },
    comments: { type: String, default: '' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

hrExpenseSchema.index({ status: 1, isDeleted: 1, createdAt: -1 });
hrExpenseSchema.index({ employeeId: 1, isDeleted: 1 });

module.exports = mongoose.model('HrExpense', hrExpenseSchema);
module.exports.EXPENSE_CATEGORIES = EXPENSE_CATEGORIES;
module.exports.EXPENSE_STATUSES = EXPENSE_STATUSES;
