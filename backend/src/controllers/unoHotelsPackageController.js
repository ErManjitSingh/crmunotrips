const asyncHandler = require('../utils/asyncHandler');
const { listUnoPackages, getUnoPackageById } = require('../services/unoHotelsPackageService');
const {
  applyMarginToPackage,
  applyMarginToPackages,
} = require('../services/destinationMarginService');

const listPackages = asyncHandler(async (req, res) => {
  const result = await listUnoPackages(req.query);
  const items = await applyMarginToPackages(result.items || []);
  res.json({ ...result, items });
});

const getPackage = asyncHandler(async (req, res) => {
  const pkg = await getUnoPackageById(req.params.id, {
    travelDate: req.query.travel_date || req.query.travelDate,
    adults: req.query.adults,
    rooms: req.query.rooms,
  });
  res.json(await applyMarginToPackage(pkg));
});

module.exports = {
  listPackages,
  getPackage,
};
