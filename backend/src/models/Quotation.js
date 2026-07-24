const mongoose = require('mongoose');

const QUOTE_STATUSES = [
  'draft',
  'pending_approval',
  'sent',
  'viewed',
  'negotiation',
  'approved',
  'rejected',
];

const timelineSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    date: { type: Date, default: Date.now },
    user: { type: String },
    notes: { type: String, default: '' },
  },
  { _id: false }
);

const quotationSchema = new mongoose.Schema(
  {
    quoteNumber: { type: String, required: true, unique: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', index: true },
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
    package: { type: mongoose.Schema.Types.ObjectId, ref: 'Package' },
    packageSnapshot: { type: mongoose.Schema.Types.Mixed },
    status: { type: String, enum: QUOTE_STATUSES, default: 'draft', index: true },
    pricing: {
      baseCost: { type: Number, default: 0 },
      hotelCost: { type: Number, default: 0 },
      cabCost: { type: Number, default: 0 },
      flightCost: { type: Number, default: 0 },
      activityCost: { type: Number, default: 0 },
      taxes: { type: Number, default: 0 },
      gstEnabled: { type: Boolean, default: false },
      markup: { type: Number, default: 0 },
      markupPercent: { type: Number, default: 0 },
      discount: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
      profitMargin: { type: Number, default: 0 },
    },
    costing: {
      lineItems: [{ type: mongoose.Schema.Types.Mixed }],
      subtotal: { type: Number, default: 0 },
      taxes: { type: Number, default: 0 },
      gstEnabled: { type: Boolean, default: false },
      markup: { type: Number, default: 0 },
      markupPercent: { type: Number, default: 0 },
      discount: { type: Number, default: 0 },
      grandTotal: { type: Number, default: 0 },
      profitMargin: { type: Number, default: 0 },
    },
    /** Executive-submitted costing snapshot */
    costing1: { type: mongoose.Schema.Types.Mixed },
    /** Approver (TL / Manager / Admin) set costing */
    costing2: { type: mongoose.Schema.Types.Mixed },
    packageSummary: { type: mongoose.Schema.Types.Mixed },
    approvedAt: { type: Date },
    selectedHotels: [{ type: mongoose.Schema.Types.Mixed }],
    selectedCabs: [{ type: mongoose.Schema.Types.Mixed }],
    selectedFlights: [{ type: mongoose.Schema.Types.Mixed }],
    selectedActivities: [{ type: mongoose.Schema.Types.Mixed }],
    customizations: { type: String, default: '' },
    createdByExecutive: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    teamLeader: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timeline: [timelineSchema],
    sentAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

quotationSchema.index({ lead: 1, status: 1 });
quotationSchema.index({ status: 1, createdAt: -1 });
quotationSchema.index({ branchId: 1, status: 1, lead: 1, updatedAt: -1 });

module.exports = mongoose.model('Quotation', quotationSchema);
module.exports.QUOTE_STATUSES = QUOTE_STATUSES;
