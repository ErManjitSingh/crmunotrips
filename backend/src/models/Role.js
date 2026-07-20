const mongoose = require('mongoose');

const permissionBlock = {
  view: { type: Boolean, default: false },
  create: { type: Boolean, default: false },
  edit: { type: Boolean, default: false },
  delete: { type: Boolean, default: false },
  approve: { type: Boolean, default: false },
  export: { type: Boolean, default: false },
};

const roleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    description: { type: String, default: '' },
    isSystem: { type: Boolean, default: false },
    userCount: { type: Number, default: 0 },
    permissions: {
      users: permissionBlock,
      leads: permissionBlock,
      customers: permissionBlock,
      quotations: permissionBlock,
      reports: permissionBlock,
      packages: permissionBlock,
      payments: permissionBlock,
      operations: permissionBlock,
      hr: permissionBlock,
      whatsapp: {
        use: { type: Boolean, default: false },
        manage: { type: Boolean, default: false },
      },
      email: {
        send: { type: Boolean, default: false },
        manage: { type: Boolean, default: false },
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Role', roleSchema);
