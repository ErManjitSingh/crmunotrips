const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const {
  getConfig,
  saveConfig,
  resetToDefaults,
} = require('../services/leadStatusConfigService');

/** Authenticated — options for status modals (enabled only) */
const getPublicConfig = asyncHandler(async (req, res) => {
  const data = await getConfig({ includeDisabled: false });
  res.json(data);
});

/** Admin — full config including disabled */
const getAdminConfig = asyncHandler(async (req, res) => {
  const data = await getConfig({ includeDisabled: true, force: true });
  res.json(data);
});

const putConfig = asyncHandler(async (req, res) => {
  try {
    const data = await saveConfig(req.body, req.user?._id);
    res.json(data);
  } catch (err) {
    throw new ApiError(err.statusCode || 400, err.message || 'Invalid config');
  }
});

const resetConfig = asyncHandler(async (req, res) => {
  const data = await resetToDefaults(req.user?._id);
  res.json(data);
});

module.exports = {
  getPublicConfig,
  getAdminConfig,
  putConfig,
  resetConfig,
};
