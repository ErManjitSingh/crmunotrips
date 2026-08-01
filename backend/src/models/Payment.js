const mongoose = require('mongoose');

const installmentSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 0 },
    receivedAt: { type: Date, default: Date.now },
    method: {
      type: String,
      enum: ['cash', 'upi', 'card', 'bank_transfer', 'cheque'],
      default: 'bank_transfer',
    },
    reference: { type: String, trim: true, default: '' },
    note: { type: String, trim: true, default: '' },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: true }
);

const paymentSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', index: true },
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
    quotation: { type: mongoose.Schema.Types.ObjectId, ref: 'Quotation' },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    customerName: { type: String, required: true },
    amount: { type: Number, required: true },
    paidAmount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['pending', 'partial', 'paid', 'refunded', 'cancelled'],
      default: 'pending',
    },
    method: { type: String, enum: ['cash', 'upi', 'card', 'bank_transfer', 'cheque'], default: 'bank_transfer' },
    dueDate: { type: Date },
    paidAt: { type: Date },
    /** Advance / token receipt voucher generated on lead conversion */
    receiptNumber: { type: String, trim: true, index: true },
    receiptHtml: { type: String, default: '' },
    receiptSentAt: { type: Date },
    receiptSentTo: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
    installments: [installmentSchema],
    /** Planned dues after token (50% / 30% mid-tour / rest last day) */
    scheduledInstallments: [
      {
        label: { type: String, trim: true, default: '' },
        percent: { type: Number, default: 0 },
        amount: { type: Number, default: 0, min: 0 },
        dueDate: { type: Date },
        status: { type: String, enum: ['pending', 'paid', 'waived'], default: 'pending' },
      },
    ],
    packageMarginPercent: { type: Number, default: 0 },
    totalCost: { type: Number, default: 0 },
    gstAmount: { type: Number, default: 0 },
    addressProofUrl: { type: String, trim: true, default: '' },
    addressProofName: { type: String, trim: true, default: '' },
    /** UPI / bank transfer payment screenshot collected on conversion */
    paymentScreenshotUrl: { type: String, trim: true, default: '' },
    paymentScreenshotName: { type: String, trim: true, default: '' },
    commercialCompletedAt: { type: Date },
    refunds: [
      {
        amount: Number,
        reason: String,
        date: { type: Date, default: Date.now },
        processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      },
    ],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

paymentSchema.index({ branchId: 1, status: 1, paidAt: -1, createdAt: -1 });
paymentSchema.index({ lead: 1, status: 1, paidAt: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
