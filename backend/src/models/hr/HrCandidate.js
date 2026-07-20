const mongoose = require('mongoose');

const STAGES = ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected'];

const hrCandidateSchema = new mongoose.Schema(
  {
    jobOpeningId: { type: mongoose.Schema.Types.ObjectId, ref: 'HrJobOpening', required: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    resumeUrl: { type: String, default: '' },
    source: { type: String, default: 'direct' },
    stage: { type: String, enum: STAGES, default: 'applied' },
    experienceYears: { type: Number, default: 0 },
    currentCtc: { type: Number, default: 0 },
    expectedCtc: { type: Number, default: 0 },
    notes: { type: String, default: '' },
    offerLetterUrl: { type: String, default: '' },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

hrCandidateSchema.index({ jobOpeningId: 1, stage: 1, isDeleted: 1 });
hrCandidateSchema.index({ stage: 1, isDeleted: 1, createdAt: -1 });

module.exports = mongoose.model('HrCandidate', hrCandidateSchema);
module.exports.STAGES = STAGES;
