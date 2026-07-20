const mongoose = require('mongoose');

const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'contract', 'intern', 'consultant'];
const EMPLOYEE_STATUSES = ['active', 'on_notice', 'on_leave', 'inactive', 'terminated'];
const GENDERS = ['male', 'female', 'other', 'prefer_not_to_say'];

const hrEmployeeSchema = new mongoose.Schema(
  {
    employeeCode: { type: String, unique: true, sparse: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    alternatePhone: { type: String, trim: true, default: '' },
    gender: { type: String, enum: GENDERS, default: 'prefer_not_to_say' },
    dateOfBirth: { type: Date, default: null },
    joiningDate: { type: Date, default: null },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'HrDepartment', default: null },
    designationId: { type: mongoose.Schema.Types.ObjectId, ref: 'HrDesignation', default: null },
    reportingManagerId: { type: mongoose.Schema.Types.ObjectId, ref: 'HrEmployee', default: null },
    employmentType: { type: String, enum: EMPLOYMENT_TYPES, default: 'full_time' },
    status: { type: String, enum: EMPLOYEE_STATUSES, default: 'active' },
    shift: { type: String, trim: true, default: 'General' },
    workLocation: { type: String, trim: true, default: '' },
    salary: { type: Number, default: 0 },
    photoUrl: { type: String, default: '' },
    address: {
      line1: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      pincode: { type: String, default: '' },
    },
    emergencyContact: {
      name: { type: String, default: '' },
      phone: { type: String, default: '' },
      relation: { type: String, default: '' },
    },
    bank: {
      accountName: { type: String, default: '' },
      accountNumber: { type: String, default: '' },
      ifsc: { type: String, default: '' },
      bankName: { type: String, default: '' },
    },
    documents: [
      {
        type: { type: String, default: 'other' },
        name: { type: String, default: '' },
        url: { type: String, default: '' },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    notes: { type: String, default: '' },
    isDeleted: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

hrEmployeeSchema.virtual('fullName').get(function fullName() {
  return [this.firstName, this.lastName].filter(Boolean).join(' ').trim();
});

hrEmployeeSchema.set('toJSON', { virtuals: true });
hrEmployeeSchema.set('toObject', { virtuals: true });

hrEmployeeSchema.index({ status: 1, isDeleted: 1, createdAt: -1 });
hrEmployeeSchema.index({ departmentId: 1, isDeleted: 1 });
hrEmployeeSchema.index({ email: 1 });
hrEmployeeSchema.index({ phone: 1 });

async function nextEmployeeCode(Model) {
  const [row] = await Model.aggregate([
    { $match: { employeeCode: { $type: 'string', $regex: /^EMP-\d+$/ } } },
    {
      $group: {
        _id: null,
        max: {
          $max: {
            $convert: {
              input: { $arrayElemAt: [{ $split: ['$employeeCode', '-'] }, 1] },
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
  return `EMP-${String(next).padStart(4, '0')}`;
}

hrEmployeeSchema.pre('save', async function assignCode(next) {
  if (this.employeeCode) return next();
  try {
    this.employeeCode = await nextEmployeeCode(this.constructor);
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model('HrEmployee', hrEmployeeSchema);
module.exports.EMPLOYMENT_TYPES = EMPLOYMENT_TYPES;
module.exports.EMPLOYEE_STATUSES = EMPLOYEE_STATUSES;
module.exports.GENDERS = GENDERS;
