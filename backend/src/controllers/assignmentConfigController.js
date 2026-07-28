const asyncHandler = require('../utils/asyncHandler');
const {
  isLeadAutoAssignmentEnabled,
  setLeadAutoAssignmentEnabled,
} = require('../config/assignment');

const getAssignmentStatus = asyncHandler(async (req, res) => {
  const enabled = await isLeadAutoAssignmentEnabled();
  res.json({
    leadAutoAssignmentEnabled: enabled,
    manualAssignmentEnabled: true,
  });
});

const updateAssignmentStatus = asyncHandler(async (req, res) => {
  if (typeof req.body?.leadAutoAssignmentEnabled !== 'boolean') {
    return res.status(400).json({ message: 'leadAutoAssignmentEnabled (boolean) is required' });
  }
  const enabled = await setLeadAutoAssignmentEnabled(req.body.leadAutoAssignmentEnabled);
  res.json({
    leadAutoAssignmentEnabled: enabled,
    manualAssignmentEnabled: true,
    message: enabled
      ? 'Auto lead assignment turned ON'
      : 'Auto lead assignment turned OFF — use manual assign',
  });
});

module.exports = { getAssignmentStatus, updateAssignmentStatus };
