const mongoose = require('mongoose');

const optionSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    enabled: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { _id: false }
);

const leadStatusConfigSchema = new mongoose.Schema(
  {
    /** Singleton key — always "default" */
    key: { type: String, default: 'default', unique: true, index: true },
    warm: { type: [optionSchema], default: [] },
    hot: { type: [optionSchema], default: [] },
    cold: { type: [optionSchema], default: [] },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('LeadStatusConfig', leadStatusConfigSchema);
