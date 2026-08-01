const mongoose = require('mongoose');

const destinationMarginSchema = new mongoose.Schema(
  {
    destinationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Destination',
      required: true,
      unique: true,
      index: true,
    },
    destinationName: { type: String, required: true, trim: true },
    /** Percentage uplift applied to package costs for this state */
    marginPercent: { type: Number, required: true, min: 0, max: 500, default: 0 },
    /** Explicit package mapping — these packages always get this state's margin */
    packageIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Package',
      },
    ],
    active: { type: Boolean, default: true, index: true },
    notes: { type: String, trim: true, maxlength: 500, default: '' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedByName: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

destinationMarginSchema.index({ packageIds: 1 });

module.exports = mongoose.model('DestinationMargin', destinationMarginSchema);
