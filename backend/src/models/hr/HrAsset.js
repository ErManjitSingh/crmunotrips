const mongoose = require('mongoose');

const ASSET_CATEGORIES = [
  'laptop',
  'mobile',
  'sim',
  'id_card',
  'camera',
  'tablet',
  'vehicle',
  'other',
];

const ASSET_STATUSES = ['available', 'assigned', 'returned', 'lost', 'retired'];

const historySchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'HrEmployee', default: null },
    note: { type: String, default: '' },
    at: { type: Date, default: Date.now },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { _id: false }
);

const hrAssetSchema = new mongoose.Schema(
  {
    assetCode: { type: String, unique: true, sparse: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, enum: ASSET_CATEGORIES, default: 'other' },
    serialNumber: { type: String, trim: true, default: '' },
    brand: { type: String, trim: true, default: '' },
    purchaseDate: { type: Date, default: null },
    purchaseValue: { type: Number, default: 0 },
    status: { type: String, enum: ASSET_STATUSES, default: 'available' },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'HrEmployee', default: null },
    assignedAt: { type: Date, default: null },
    notes: { type: String, default: '' },
    history: { type: [historySchema], default: [] },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

hrAssetSchema.index({ status: 1, isDeleted: 1 });
hrAssetSchema.index({ category: 1, isDeleted: 1 });
hrAssetSchema.index({ assignedTo: 1 });

async function nextAssetCode(Model) {
  const [row] = await Model.aggregate([
    { $match: { assetCode: { $type: 'string', $regex: /^AST-\d+$/ } } },
    {
      $group: {
        _id: null,
        max: {
          $max: {
            $convert: {
              input: { $arrayElemAt: [{ $split: ['$assetCode', '-'] }, 1] },
              to: 'int',
              onError: 0,
              onNull: 0,
            },
          },
        },
      },
    },
  ]);
  return `AST-${String((row?.max || 0) + 1).padStart(4, '0')}`;
}

hrAssetSchema.pre('save', async function assignCode(next) {
  if (this.assetCode) return next();
  try {
    this.assetCode = await nextAssetCode(this.constructor);
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model('HrAsset', hrAssetSchema);
module.exports.ASSET_CATEGORIES = ASSET_CATEGORIES;
module.exports.ASSET_STATUSES = ASSET_STATUSES;
