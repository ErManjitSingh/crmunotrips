const mongoose = require('mongoose');

const LEAD_STATUSES = [
  'new',
  'contacted',
  'working_progress',
  'follow_up',
  'quotation_sent',
  'negotiation',
  'reactivated',
  'converted',
  'lost',
  'booked_from_another_company',
];

const BUDGET_RANGES = [
  'under_20000',
  '20000_40000',
  '40000_60000',
  '60000_100000',
  'above_100000',
  'custom',
];

const LEAD_SCORES = ['low', 'medium', 'high', 'hot'];

const LEAD_TYPES = ['fit', 'group', 'corporate'];

const REACTIVATION_STAGES = [
  'reactivated',
  'reassigned',
  'contacted',
  'follow_up_scheduled',
  'quotation_sent',
  'converted',
];

const leadSchema = new mongoose.Schema(
  {
    leadId: { type: String, unique: true, sparse: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true },
    alternateEmail: { type: String, trim: true },
    phone: { type: String, required: true, trim: true, index: true },
    alternatePhone: { type: String, trim: true, index: true },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', index: true },
    whatsapp: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    destination: { type: String, required: true, trim: true, index: true },
    leadType: { type: String, enum: LEAD_TYPES, default: 'fit', index: true },
    leadTypeSource: { type: String, enum: ['manual', 'auto'], default: 'auto' },
    companyName: { type: String, trim: true, default: '' },
    travelDate: { type: Date },
    returnDate: { type: Date },
    tourDays: { type: Number, default: 0 },
    pickupPoint: { type: String, trim: true, default: '' },
    dropPoint: { type: String, trim: true, default: '' },
    numberOfRooms: { type: Number, default: 1 },
    cabType: { type: String, trim: true, default: '' },
    budget: { type: Number, default: 0 },
    budgetRange: { type: String, enum: BUDGET_RANGES, default: 'custom' },
    leadScore: { type: String, enum: LEAD_SCORES, default: 'low', index: true },
    smartScore: { type: Number, default: 0, min: 0, max: 100, index: true },
    temperature: { type: String, enum: ['hot', 'warm', 'cold', 'vip'], default: 'cold', index: true },
    agingBucket: { type: String, enum: ['0_7', '8_15', '16_30', '30_plus'], default: '0_7', index: true },
    isVip: { type: Boolean, default: false, index: true },
    responseRate: { type: Number, default: 0, min: 0, max: 100 },
    firstContactAt: { type: Date },
    lastContactedAt: { type: Date, index: true },
    lastContactMethod: {
      type: String,
      enum: ['call', 'whatsapp', 'email', ''],
      default: '',
    },
    lastContactedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    slaContactedAt: { type: Date },
    slaBreached: { type: Boolean, default: false, index: true },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    travelers: { type: Number, default: 1 },
    adults: { type: Number, default: 1 },
    children: { type: Number, default: 0 },
    infants: { type: Number, default: 0 },
    status: { type: String, enum: LEAD_STATUSES, default: 'new', index: true },
    statusReason: { type: String, trim: true, default: '' },
    statusReasonUpdatedAt: { type: Date },
    source: {
      type: String,
      enum: [
        'website',
        'referral',
        'social',
        'walk-in',
        'phone',
        'whatsapp',
        'other',
        'google_ads',
        'facebook_ads',
        'organic',
      ],
      default: 'website',
    },
    leadSource: { type: String },
    sourceLabel: { type: String },
    hotelCategory: { type: String },
    mealPreference: { type: String },
    transportRequirement: { type: String },
    specialRequirements: { type: String },
    followUpRemarks: { type: String },
    priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
    notes: { type: String, default: '' },
    isHot: { type: Boolean, default: false },
    isRepeatCustomer: { type: Boolean, default: false },
    assigneeRole: { type: String },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    assignedAt: { type: Date, index: true },
    executiveLastViewedAt: { type: Date },
    assignedManager: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedTeamLeader: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    lastFollowUp: { type: Date },
    nextFollowUp: { type: Date },
    channel: { type: String, default: 'crm' },
    externalLeadId: { type: String, trim: true, index: true, sparse: true },
    externalLeadSource: { type: String, trim: true },
    reactivation: {
      isReactivated: { type: Boolean, default: false, index: true },
      previousLostStatus: { type: String, enum: ['lost', 'booked_from_another_company', ''] },
      reactivatedAt: { type: Date },
      reactivatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      reactivatedReason: { type: String, trim: true, default: '' },
      reassignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      reassignedAt: { type: Date },
      reassignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      stage: { type: String, enum: REACTIVATION_STAGES },
      stageUpdatedAt: { type: Date },
      stageHistory: [
        {
          stage: { type: String, enum: REACTIVATION_STAGES, required: true },
          at: { type: Date, default: Date.now },
          by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
          note: { type: String, trim: true, default: '' },
        },
      ],
    },
  },
  { timestamps: true }
);

leadSchema.index({ createdAt: -1 });
leadSchema.index({ status: 1, createdAt: -1 });
leadSchema.index({ assignedTo: 1, status: 1 });
leadSchema.index({ branchId: 1, assignedTo: 1, status: 1 });
leadSchema.index({ branchId: 1, assignedTo: 1, isHot: 1, status: 1 });
leadSchema.index({ branchId: 1, 'reactivation.isReactivated': 1, 'reactivation.stage': 1, updatedAt: -1 });

async function nextLeadId(Model) {
  // Use max numeric suffix — countDocuments() reuses IDs after soft-deletes/gaps
  // and trips unique leadId (website email still succeeds, CRM push fails).
  const [row] = await Model.aggregate([
    { $match: { leadId: { $type: 'string', $regex: /^L-\d+$/ } } },
    {
      $group: {
        _id: null,
        max: {
          $max: {
            $convert: {
              input: { $arrayElemAt: [{ $split: ['$leadId', '-'] }, 1] },
              to: 'int',
              onError: 0,
              onNull: 0,
            },
          },
        },
      },
    },
  ]);
  const next = (row?.max || 0) + 1;
  return `L-${String(next).padStart(4, '0')}`;
}

leadSchema.pre('save', async function generateLeadId(next) {
  if (this.leadId) return next();
  try {
    this.leadId = await nextLeadId(this.constructor);
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model('Lead', leadSchema);
module.exports.LEAD_STATUSES = LEAD_STATUSES;
module.exports.REACTIVATION_STAGES = REACTIVATION_STAGES;
module.exports.BUDGET_RANGES = BUDGET_RANGES;
module.exports.LEAD_SCORES = LEAD_SCORES;
module.exports.LEAD_TYPES = LEAD_TYPES;
