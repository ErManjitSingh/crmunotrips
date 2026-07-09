const mongoose = require('mongoose');

const itineraryDaySchema = new mongoose.Schema(
  {
    day: { type: Number, required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    meals: { type: String, default: '' },
    accommodation: { type: String, default: '' },
    hotel: { type: String, default: '' },
    activities: { type: String, default: '' },
    transport: { type: String, default: '' },
  },
  { _id: true }
);

const packageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    destination: { type: String, required: true, trim: true },
    duration: { type: Number, required: true, min: 1 },
    durationLabel: { type: String, default: '' },
    startingPrice: { type: Number, default: 0 },
    packageType: { type: String, default: 'domestic', trim: true },
    packageCode: { type: String, default: '' },
    shortDescription: { type: String, default: '' },
    coverImage: { type: String, default: '' },
    inclusions: { type: [String], default: [] },
    exclusions: { type: [String], default: [] },
    itinerary: [itineraryDaySchema],
    sourceType: { type: String, enum: ['local', 'uno_clone'], default: 'local' },
    sourcePackageId: { type: String, default: null },
    sourceSlug: { type: String, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Package', packageSchema);
