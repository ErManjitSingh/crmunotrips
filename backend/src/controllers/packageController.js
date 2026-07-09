const Package = require('../models/Package');
const Hotel = require('../models/Hotel');
const Cab = require('../models/Cab');
const Flight = require('../models/Flight');
const ApiError = require('../utils/apiError');
const asyncHandler = require('../utils/asyncHandler');
const { getUnoPackageById } = require('../services/unoHotelsPackageService');

function mapItineraryForDb(days = []) {
  return days.map((day) => ({
    day: day.day,
    title: day.title || `Day ${day.day}`,
    description: day.description || '',
    meals: day.meals || '',
    accommodation: day.accommodation || day.hotel || '',
    hotel: day.hotel || '',
    activities: day.activities || '',
    transport: day.transport || '',
  }));
}

function mapUnoDetailToPackageDoc(detail, userId) {
  return {
    name: detail.name,
    destination: detail.destination,
    duration: detail.duration || 1,
    durationLabel: detail.durationLabel || '',
    startingPrice: detail.startingPrice || 0,
    packageType: detail.packageType || 'domestic',
    packageCode: detail.packageCode || '',
    shortDescription: detail.shortDescription || '',
    coverImage: detail.coverImage || '',
    inclusions: detail.inclusions || [],
    exclusions: detail.exclusions || [],
    itinerary: mapItineraryForDb(detail.itinerary || []),
    sourceType: 'uno_clone',
    sourcePackageId: String(detail.id || detail._id || ''),
    sourceSlug: detail.slug || '',
    createdBy: userId,
  };
}

function applySearch(items, search) {
  if (!search) return items;
  const q = search.toLowerCase();
  return items.filter((item) => JSON.stringify(item).toLowerCase().includes(q));
}

const listPackages = asyncHandler(async (req, res) => {
  const { search, packageType } = req.query;
  const filter = {};
  if (packageType) filter.packageType = packageType;

  let packages = await Package.find(filter).sort({ createdAt: -1 }).lean();
  packages = applySearch(packages, search);
  res.json(packages);
});

const getPackage = asyncHandler(async (req, res) => {
  const pkg = await Package.findById(req.params.id).lean();
  if (!pkg) throw new ApiError(404, 'Package not found');
  res.json(pkg);
});

const createPackage = asyncHandler(async (req, res) => {
  const pkg = await Package.create({ ...req.body, createdBy: req.user._id });
  res.status(201).json(pkg);
});

const updatePackage = asyncHandler(async (req, res) => {
  const pkg = await Package.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!pkg) throw new ApiError(404, 'Package not found');
  res.json(pkg);
});

const deletePackage = asyncHandler(async (req, res) => {
  const pkg = await Package.findById(req.params.id);
  if (!pkg) throw new ApiError(404, 'Package not found');
  await pkg.deleteOne();
  res.json({ message: 'Package deleted' });
});

const duplicatePackage = asyncHandler(async (req, res) => {
  const original = await Package.findById(req.params.id).lean();
  if (!original) throw new ApiError(404, 'Package not found');

  const { _id, createdAt, updatedAt, ...rest } = original;
  const copy = await Package.create({
    ...rest,
    name: `${original.name} (Copy)`,
    itinerary: (original.itinerary || []).map((d) => ({ ...d })),
    inclusions: [...(original.inclusions || [])],
    exclusions: [...(original.exclusions || [])],
    sourceType: 'uno_clone',
    sourcePackageId: original.sourcePackageId || null,
    sourceSlug: original.sourceSlug || null,
    createdBy: req.user._id,
  });
  res.status(201).json(copy);
});

const cloneFromUnoPackage = asyncHandler(async (req, res) => {
  const detail = await getUnoPackageById(req.params.unoId);
  const payload = mapUnoDetailToPackageDoc(detail, req.user._id);
  const copy = await Package.create({
    ...payload,
    name: `${payload.name} (Copy)`,
  });
  res.status(201).json(copy);
});

const listHotels = asyncHandler(async (req, res) => {
  const hotels = await Hotel.find().sort({ createdAt: -1 }).lean();
  res.json(applySearch(hotels, req.query.search));
});

const createHotel = asyncHandler(async (req, res) => {
  const hotel = await Hotel.create(req.body);
  res.status(201).json(hotel);
});

const updateHotel = asyncHandler(async (req, res) => {
  const hotel = await Hotel.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!hotel) throw new ApiError(404, 'Hotel not found');
  res.json(hotel);
});

const deleteHotel = asyncHandler(async (req, res) => {
  const hotel = await Hotel.findById(req.params.id);
  if (!hotel) throw new ApiError(404, 'Hotel not found');
  await hotel.deleteOne();
  res.json({ message: 'Hotel deleted' });
});

const listCabs = asyncHandler(async (req, res) => {
  const cabs = await Cab.find().sort({ createdAt: -1 }).lean();
  res.json(applySearch(cabs, req.query.search));
});

const createCab = asyncHandler(async (req, res) => {
  const cab = await Cab.create(req.body);
  res.status(201).json(cab);
});

const updateCab = asyncHandler(async (req, res) => {
  const cab = await Cab.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!cab) throw new ApiError(404, 'Cab not found');
  res.json(cab);
});

const deleteCab = asyncHandler(async (req, res) => {
  const cab = await Cab.findById(req.params.id);
  if (!cab) throw new ApiError(404, 'Cab not found');
  await cab.deleteOne();
  res.json({ message: 'Cab deleted' });
});

const listFlights = asyncHandler(async (req, res) => {
  const flights = await Flight.find().sort({ createdAt: -1 }).lean();
  res.json(applySearch(flights, req.query.search));
});

const createFlight = asyncHandler(async (req, res) => {
  const flight = await Flight.create(req.body);
  res.status(201).json(flight);
});

const updateFlight = asyncHandler(async (req, res) => {
  const flight = await Flight.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!flight) throw new ApiError(404, 'Flight not found');
  res.json(flight);
});

const deleteFlight = asyncHandler(async (req, res) => {
  const flight = await Flight.findById(req.params.id);
  if (!flight) throw new ApiError(404, 'Flight not found');
  await flight.deleteOne();
  res.json({ message: 'Flight deleted' });
});

module.exports = {
  listPackages,
  getPackage,
  createPackage,
  updatePackage,
  deletePackage,
  duplicatePackage,
  cloneFromUnoPackage,
  listHotels,
  createHotel,
  updateHotel,
  deleteHotel,
  listCabs,
  createCab,
  updateCab,
  deleteCab,
  listFlights,
  createFlight,
  updateFlight,
  deleteFlight,
};
