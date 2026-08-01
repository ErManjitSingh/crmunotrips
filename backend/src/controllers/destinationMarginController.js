const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/apiError');
const {
  listDestinationMargins,
  upsertDestinationMargin,
  bulkUpsertDestinationMargins,
  resolveMarginForDestination,
} = require('../services/destinationMarginService');

const listMargins = asyncHandler(async (req, res) => {
  const rows = await listDestinationMargins();
  res.json(rows);
});

const upsertMargin = asyncHandler(async (req, res) => {
  const destinationId = req.params.destinationId || req.body.destinationId;
  if (!destinationId) throw new ApiError(400, 'destinationId is required');

  const row = await upsertDestinationMargin(req, {
    destinationId,
    marginPercent: req.body.marginPercent,
    notes: req.body.notes,
    active: req.body.active,
    packageIds: req.body.packageIds,
  });
  res.json(row);
});

const bulkUpsertMargins = asyncHandler(async (req, res) => {
  const items = req.body?.items || req.body?.margins || [];
  const rows = await bulkUpsertDestinationMargins(req, items);
  res.json(rows);
});

const lookupMargin = asyncHandler(async (req, res) => {
  const destination = req.query.destination || req.query.q || '';
  const match = await resolveMarginForDestination(destination);
  res.json(
    match || {
      destinationId: null,
      destinationName: null,
      marginPercent: 0,
    }
  );
});

module.exports = {
  listMargins,
  upsertMargin,
  bulkUpsertMargins,
  lookupMargin,
};
