const mongoose = require('mongoose');

const ANNOUNCEMENT_TYPES = [
  'offer',
  'promotion',
  'contest',
  'holiday',
  'target',
  'maintenance',
  'policy',
  'festival',
  'emergency',
  'update',
  'incentive',
];

const PRIORITIES = ['low', 'normal', 'high', 'urgent'];

const AUDIENCE_ROLES = [
  'admin',
  'sales_manager',
  'team_leader',
  'sales_executive',
  'accountant',
  'operations_manager',
];

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    bodyHtml: { type: String, default: '' },
    type: { type: String, enum: ANNOUNCEMENT_TYPES, default: 'update', index: true },
    priority: { type: String, enum: PRIORITIES, default: 'normal', index: true },
    badge: { type: String, trim: true, default: '' },
    tags: [{ type: String, trim: true }],
    icon: { type: String, trim: true, default: '' },
    bannerImage: { type: String, trim: true, default: '' },
    gradientTheme: { type: String, trim: true, default: '' },
    audienceRoles: {
      type: [{ type: String, enum: AUDIENCE_ROLES }],
      default: ['sales_executive'],
    },
    branchIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Branch' }],
    customUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    publishAt: { type: Date, default: Date.now, index: true },
    expiresAt: { type: Date, default: null, index: true },
    pinToDashboard: { type: Boolean, default: false, index: true },
    enablePopup: { type: Boolean, default: false },
    enableEmail: { type: Boolean, default: false },
    enablePush: { type: Boolean, default: false },
    enableWhatsApp: { type: Boolean, default: false },
    ctaText: { type: String, trim: true, default: 'View Details' },
    ctaUrl: { type: String, trim: true, default: '' },
    secondaryCtaText: { type: String, trim: true, default: 'Participate Now' },
    secondaryCtaUrl: { type: String, trim: true, default: '' },
    progressLabel: { type: String, trim: true, default: 'Campaign Progress' },
    progressPercent: { type: Number, min: 0, max: 100, default: null },
    active: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    dismissals: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        at: { type: Date, default: Date.now },
        remindAt: { type: Date, default: null },
      },
    ],
    reads: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        at: { type: Date, default: Date.now },
      },
    ],
    popupSeen: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        at: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

announcementSchema.index({ active: 1, publishAt: 1, expiresAt: 1, pinToDashboard: -1 });
announcementSchema.index({ 'dismissals.user': 1 });

module.exports = mongoose.model('Announcement', announcementSchema);
module.exports.ANNOUNCEMENT_TYPES = ANNOUNCEMENT_TYPES;
module.exports.PRIORITIES = PRIORITIES;
module.exports.AUDIENCE_ROLES = AUDIENCE_ROLES;
