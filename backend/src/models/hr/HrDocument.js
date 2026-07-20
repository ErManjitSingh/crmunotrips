const mongoose = require('mongoose');

const DOC_TYPES = [
  'aadhar',
  'pan',
  'passport',
  'offer_letter',
  'joining_letter',
  'experience_letter',
  'salary_slip',
  'certificate',
  'driving_license',
  'education',
  'police_verification',
  'medical',
  'nda',
  'bank_details',
  'other',
];

const hrDocumentSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'HrEmployee', required: true },
    docType: { type: String, enum: DOC_TYPES, default: 'other' },
    title: { type: String, required: true, trim: true },
    fileUrl: { type: String, default: '' },
    fileName: { type: String, default: '' },
    expiryDate: { type: Date, default: null },
    notes: { type: String, default: '' },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

hrDocumentSchema.index({ employeeId: 1, isDeleted: 1 });
hrDocumentSchema.index({ docType: 1, isDeleted: 1 });
hrDocumentSchema.index({ expiryDate: 1 });

module.exports = mongoose.model('HrDocument', hrDocumentSchema);
module.exports.DOC_TYPES = DOC_TYPES;
