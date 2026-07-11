const asyncHandler = require('../utils/asyncHandler');
const {
  searchUnoCabs,
  calculateUnoCabFare,
  getUnoCabDetail,
} = require('../services/unoHotelsCabService');

const searchCabs = asyncHandler(async (req, res) => {
  const result = await searchUnoCabs(req.query);
  res.json(result);
});

const calculateFare = asyncHandler(async (req, res) => {
  const result = await calculateUnoCabFare(req.body);
  res.json(result);
});

const getCabDetail = asyncHandler(async (req, res) => {
  const cab = await getUnoCabDetail(req.params.slug);
  res.json(cab);
});

module.exports = {
  searchCabs,
  calculateFare,
  getCabDetail,
};
