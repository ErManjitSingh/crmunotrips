const mongoose = require('mongoose');

function normalizeDestinationKey(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

const destinationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    normalizedKey: { type: String, required: true, trim: true, index: true },
    aliases: [{ type: String, trim: true }],
    /** city = lead assignment spots; state = margin-control rows only */
    kind: {
      type: String,
      enum: ['city', 'state', 'region'],
      default: 'city',
      index: true,
    },
    status: { type: String, enum: ['active', 'inactive'], default: 'active', index: true },
    description: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

destinationSchema.index({ name: 1 }, { unique: true });

destinationSchema.pre('validate', function setNormalizedKey(next) {
  if (this.name) {
    this.normalizedKey = normalizeDestinationKey(this.name);
  }
  next();
});

destinationSchema.statics.normalizeKey = normalizeDestinationKey;

module.exports = mongoose.model('Destination', destinationSchema);
module.exports.normalizeDestinationKey = normalizeDestinationKey;
