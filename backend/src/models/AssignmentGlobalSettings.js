const mongoose = require('mongoose');

/** Singleton document for system-wide assignment switches. */
const assignmentGlobalSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'global' },
    leadAutoAssignmentEnabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AssignmentGlobalSettings', assignmentGlobalSettingsSchema);
