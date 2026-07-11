const ApiError = require('../utils/apiError');
const {
  inferCityFromDestination,
  inferStateFromDestination,
  parseRouteCities,
} = require('../utils/destinationMatch');
const { unwrapPayload, unwrapListPayload, unoFetch } = require('./unoHotelsApiClient');

function mapCabType(cab = {}) {
  return {
    _id: cab.id || cab.slug,
    id: cab.id,
    slug: cab.slug,
    name: cab.name,
    vehicleType: cab.cab_category || cab.name,
    cabCategory: cab.cab_category || '',
    seatingCapacity: cab.seating_capacity,
    luggageCapacity: cab.luggage_capacity,
    isAc: cab.is_ac,
    fuelType: cab.fuel_type,
    features: cab.features || [],
    featuredImage: cab.featured_image || '',
    galleryImages: cab.gallery_images || [],
    vehicleModel: cab.vehicle_model || '',
    basePricePerDay: Number(cab.base_price_per_day || 0),
    externalSource: 'uno_cabs',
  };
}

function mapCabSearchResult(item = {}, query = {}) {
  const cabRaw = item.cab_type || item.cab || item;
  const fare = item.fare || item.fare_breakdown || item.fareBreakdown || {};
  const cab = mapCabType(cabRaw);
  const totalAmount = Number(
    item.total_amount
    ?? item.total
    ?? fare.total_amount
    ?? fare.subtotal_selling
    ?? 0
  );

  return {
    ...cab,
    pickupCity: item.pickup_city || query.pickup_city || '',
    dropCity: item.drop_city || query.drop_city || '',
    dropState: item.drop_state || query.drop_state || '',
    tripType: item.trip_type || query.trip_type || 'full_day',
    travelDate: item.travel_date || query.travel_date || '',
    returnDate: item.return_date || query.return_date || null,
    passengers: Number(item.passengers || query.passengers || 1),
    cost: totalAmount,
    totalAmount,
    fare,
    pickupLocation: item.pickup_city || query.pickup_city || '',
    dropLocation: item.drop_city || query.drop_city || '',
  };
}

function mapFareBreakdown(fare = {}) {
  return {
    totalAmount: Number(fare.total_amount || 0),
    subtotalSelling: Number(fare.subtotal_selling || 0),
    tripFareSelling: Number(fare.trip_fare_selling || 0),
    driverAllowance: Number(fare.driver_allowance || 0),
    nightCharge: Number(fare.night_charge || 0),
    gstAmount: Number(fare.gst_amount || 0),
    billedDistanceKm: Number(fare.billed_distance_km || 0),
    seasonApplied: fare.season_applied || '',
    rateType: fare.rate_type || '',
  };
}

function resolveCabSearchDefaults(query = {}) {
  const destination = query.destination || '';
  const routing = query.routing || '';
  const routeCities = parseRouteCities(routing);
  const pickupCity = query.pickup_city
    || routeCities[0]
    || inferCityFromDestination(destination);
  const dropCity = query.drop_city
    || routeCities[routeCities.length - 1]
    || inferCityFromDestination(destination);
  const dropState = query.drop_state || inferStateFromDestination(destination);

  return {
    pickupCity: String(pickupCity || '').trim(),
    dropCity: String(dropCity || '').trim(),
    dropState: String(dropState || '').trim(),
    tripType: query.trip_type || 'full_day',
    travelDate: query.travel_date || '',
    returnDate: query.return_date || null,
    passengers: Math.min(50, Math.max(1, Number(query.passengers) || 2)),
  };
}

async function searchUnoCabs(query = {}) {
  const defaults = resolveCabSearchDefaults(query);
  const {
    pickupCity,
    dropCity,
    dropState,
    tripType,
    travelDate,
    returnDate,
    passengers,
  } = defaults;

  if (!pickupCity || !dropCity || !dropState || !travelDate) {
    throw new ApiError(400, 'pickup_city, drop_city, drop_state, and travel_date are required for cab search');
  }

  const apiQuery = {
    pickup_city: pickupCity,
    drop_city: dropCity,
    drop_state: dropState,
    trip_type: tripType,
    travel_date: travelDate,
    passengers,
  };
  if (returnDate) apiQuery.return_date = returnDate;

  const raw = await unoFetch('/v1/cabs/search', { query: apiQuery });
  const rows = unwrapListPayload(raw).map((item) => mapCabSearchResult(item, apiQuery));

  return {
    items: rows,
    total: rows.length,
    search: defaults,
    source: 'uno_cabs',
  };
}

async function calculateUnoCabFare(body = {}) {
  const payload = {
    cab_type_id: body.cab_type_id || body.cabTypeId || body.id,
    pickup_city: body.pickup_city || body.pickupCity,
    drop_city: body.drop_city || body.dropCity,
    drop_state: body.drop_state || body.dropState,
    trip_type: body.trip_type || body.tripType || 'full_day',
    travel_date: body.travel_date || body.travelDate,
    pickup_time: body.pickup_time || body.pickupTime || null,
  };

  if (!payload.cab_type_id) throw new ApiError(400, 'cab_type_id is required');

  const raw = await unoFetch('/v1/cabs/fare', {
    method: 'POST',
    body: payload,
  });

  const fare = mapFareBreakdown(unwrapPayload(raw));
  return { fare, totalAmount: fare.totalAmount, source: 'uno_cabs' };
}

async function getUnoCabDetail(slug) {
  if (!slug?.trim()) throw new ApiError(400, 'Cab slug is required');
  const raw = await unoFetch(`/v1/cabs/${encodeURIComponent(slug.trim())}`);
  const cab = unwrapPayload(raw);
  return mapCabType(cab);
}

module.exports = {
  searchUnoCabs,
  calculateUnoCabFare,
  getUnoCabDetail,
  mapCabSearchResult,
  resolveCabSearchDefaults,
};
