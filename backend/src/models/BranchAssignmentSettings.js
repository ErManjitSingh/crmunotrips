const mongoose = require('mongoose');

const branchAssignmentSettingsSchema = new mongoose.Schema(
  {
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true, unique: true },
    autoAssignEnabled: { type: Boolean, default: true },
    skillAutoAssignEnabled: { type: Boolean, default: true },
    fallbackUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    salesManagerQueueIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    fallbackRoundRobinIndex: { type: Number, default: -1 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('BranchAssignmentSettings', branchAssignmentSettingsSchema);
