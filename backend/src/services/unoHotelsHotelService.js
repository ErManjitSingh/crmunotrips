const ApiError = require('../utils/apiError');
const {
  inferCityFromDestination,
  matchesDestination,
} = require('../utils/destinationMatch');
const {
  unwrapPayload,
  unwrapListPayload,
  sanitizeImageUrl,
  sanitizeImages,
  unoFetch,
} = require('./unoHotelsApiClient');
const { applyOpsRateOverridesToHotel } = require('./unoHotelsOpsService');

function extractWebsiteRoomRates(rates) {
  if (!rates || typeof rates !== 'object') return null;
  const room = rates.website?.room || rates.room || null;
  if (!room || typeof room !== 'object') return null;
  const ep = Number(room.ep || 0);
  const cp = Number(room.cp || 0);
  const mapRate = Number(room.map || 0);
  const ap = Number(room.ap || 0);
  if (!ep && !cp && !mapRate && !ap) return null;
  return { ep, cp, map: mapRate, ap };
}

/**
 * Quotation hotel rates: raw website rack only.
 * Do not use weekend_markup_percent or dated rate_plan_prices (those bake ~10% markup).
 * CRM adds destination admin margin separately.
 */
function resolveWebsiteSellRates(room = {}) {
  return extractWebsiteRoomRates(room.rates);
}

function extractWebsiteExtraBedRates(rates) {
  if (!rates || typeof rates !== 'object') return null;
  const bed = rates.website?.extra_bed || rates.extra_bed || null;
  if (!bed || typeof bed !== 'object') return null;
  const ep = Number(bed.ep || 0);
  const cp = Number(bed.cp || 0);
  const mapRate = Number(bed.map || 0);
  const ap = Number(bed.ap || 0);
  if (!ep && !cp && !mapRate && !ap) return null;
  return { ep, cp, map: mapRate, ap };
}

function pickExtraBedNightRate(extraBedRates, mealKey = 'map') {
  const rates = extraBedRates && typeof extraBedRates === 'object' ? extraBedRates : {};
  const want = String(mealKey || 'map').toLowerCase();
  const keyed = Number(rates[want] || 0);
  if (keyed > 0) return keyed;
  for (const key of ['map', 'cp', 'ep', 'ap']) {
    if (Number(rates[key] || 0) > 0) return Number(rates[key]);
  }
  return 0;
}

function buildMealPlanOptions(mealPlans = {}, sellRates = null) {
  const fromRates =
    sellRates && typeof sellRates === 'object' && (sellRates.ep || sellRates.cp || sellRates.map || sellRates.ap)
      ? {
          ep: Number(sellRates.ep || 0),
          cp: Number(sellRates.cp || 0),
          map: Number(sellRates.map || 0),
          ap: Number(sellRates.ap || 0),
        }
      : extractWebsiteRoomRates(sellRates);
  const breakfast = Number(mealPlans.breakfast) || 0;
  const lunch = Number(mealPlans.lunch) || 0;
  const dinner = Number(mealPlans.dinner) || 0;

  if (fromRates) {
    const positives = [fromRates.ep, fromRates.cp, fromRates.map, fromRates.ap].filter((n) => n > 0);
    const base = fromRates.ep > 0 ? fromRates.ep : positives.length ? Math.min(...positives) : 0;
    // Prefer explicit MAP rack; if missing, estimate EP/CP + dinner supplement.
    let mapAbs = Number(fromRates.map) || 0;
    if (!(mapAbs > 0) && base > 0) {
      if (breakfast || dinner) mapAbs = base + breakfast + dinner;
      else if (fromRates.cp > 0 && dinner) mapAbs = fromRates.cp + dinner;
    }
    const plans = [
      {
        key: 'ep',
        label: 'EP (Room Only)',
        price: Math.max(0, fromRates.ep - base),
        absolutePrice: fromRates.ep,
        meals: [],
      },
      {
        key: 'cp',
        label: 'CP — Breakfast',
        price: Math.max(0, fromRates.cp - base),
        absolutePrice: fromRates.cp,
        meals: ['breakfast'],
      },
      {
        key: 'map',
        label: 'MAP — Breakfast + Dinner',
        price: Math.max(0, mapAbs - base),
        absolutePrice: mapAbs,
        meals: ['breakfast', 'dinner'],
      },
      {
        key: 'ap',
        label: 'AP — All Meals',
        price: Math.max(0, fromRates.ap - base),
        absolutePrice: fromRates.ap,
        meals: ['breakfast', 'lunch', 'dinner'],
      },
    ];
    // Keep any plan with a real rack rate; always keep MAP so CRM can default to it.
    return plans.filter(
      (plan) => Number(plan.absolutePrice) > 0 || plan.key === 'map'
    );
  }

  return [
    { key: 'ep', label: 'EP (Room Only)', price: 0, absolutePrice: 0, meals: [] },
    { key: 'cp', label: 'CP — Breakfast', price: breakfast, absolutePrice: 0, meals: ['breakfast'] },
    {
      key: 'map',
      label: 'MAP — Breakfast + Dinner',
      price: breakfast + dinner,
      absolutePrice: 0,
      meals: ['breakfast', 'dinner'],
    },
    {
      key: 'ap',
      label: 'AP — All Meals',
      price: breakfast + lunch + dinner,
      absolutePrice: 0,
      meals: ['breakfast', 'lunch', 'dinner'],
    },
  ];
}

function mapHotelSummary(hotel = {}) {
  return {
    _id: hotel.id,
    id: hotel.id,
    slug: hotel.slug,
    name: hotel.name,
    city: hotel.city,
    state: hotel.state,
    country: hotel.country,
    address: hotel.address,
    location: [hotel.city, hotel.state].filter(Boolean).join(', '),
    category: hotel.star_category ? `${hotel.star_category} Star` : 'Hotel',
    starCategory: hotel.star_category,
    thumbnailUrl: sanitizeImageUrl(hotel.thumbnail_url),
    images: sanitizeImages(hotel.images),
    startingPrice: Number(hotel.starting_price || 0),
    currency: hotel.currency || 'INR',
    amenities: hotel.amenities || [],
    tags: hotel.tags || [],
    rating: hotel.rating || 0,
    reviewCount: hotel.review_count || 0,
    description: hotel.description || '',
    externalSource: 'uno_hotels',
  };
}

function mapRoom(room = {}) {
  const rateMap = resolveWebsiteSellRates(room);
  const extraBedRates = extractWebsiteExtraBedRates(room.rates);
  // Prefer raw website rack — price_per_night often already includes website 10% markup.
  const pricePerNight = Number(
    rateMap?.ep || rateMap?.cp || rateMap?.map || rateMap?.ap || room.price_per_night || 0
  );
  return {
    _id: room.id,
    id: room.id,
    hotelId: room.hotel_id,
    name: room.name,
    description: room.description || '',
    maxOccupancy: room.max_occupancy,
    bedType: room.bed_type,
    sizeSqft: room.size_sqft,
    amenities: room.amenities || [],
    images: sanitizeImages(room.images, { allowDataImages: true }),
    pricePerNight,
    epPrice: Number(rateMap?.ep || pricePerNight || 0),
    rates: rateMap,
    extraBedRates,
    available: room.available !== false,
    availableCount: room.available_count,
    mealPlanOptions: buildMealPlanOptions(room.meal_plans, rateMap),
    rawMealPlans: room.meal_plans || {},
  };
}

function filterHotelsByDestination(hotels, destination) {
  if (!destination) return hotels;
  return hotels.filter((hotel) => matchesDestination(hotel, destination));
}

async function fetchHotelRows(query = {}) {
  const raw = await unoFetch('/v1/hotels/search', { query });
  return unwrapListPayload(raw).map(mapHotelSummary);
}

async function listUnoHotels(query = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(Number(query.limit) || 24, 100);
  const destination = query.destination || '';
  const city = query.city || inferCityFromDestination(destination);
  const searchTerm = String(query.search || query.q || '').trim();

  let rows = [];
  if (city) {
    try {
      rows = await fetchHotelRows({
        page,
        limit: searchTerm ? Math.max(limit, 50) : limit,
        sort: query.sort || 'popular',
        city,
        ...(query.star_category ? { star_category: query.star_category } : {}),
        ...(searchTerm ? { q: searchTerm } : {}),
      });
    } catch {
      rows = [];
    }
  }

  rows = filterHotelsByDestination(rows, destination);

  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    rows = rows.filter((hotel) =>
      [hotel.name, hotel.city, hotel.location, hotel.category, ...(hotel.tags || [])]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }

  if (rows.length === 0 && destination && !searchTerm) {
    try {
      const broadRows = await fetchHotelRows({
        page: 1,
        limit: Math.max(limit, 50),
        sort: 'popular',
      });
      rows = filterHotelsByDestination(broadRows, destination);
    } catch {
      rows = [];
    }
  }

  if (rows.length === 0) {
    try {
      const featuredRaw = await unoFetch('/v1/hotels/featured', { query: { limit: Math.max(limit, 50) } });
      rows = filterHotelsByDestination(unwrapListPayload(featuredRaw).map(mapHotelSummary), destination);
    } catch {
      rows = [];
    }
  }

  return {
    items: rows.slice(0, limit),
    total: rows.length,
    page,
    limit,
    city: city || null,
    destination: destination || null,
    source: 'uno_hotels',
  };
}

async function getUnoHotelDetail({ city, slug, checkIn, checkOut, rooms, adults } = {}) {
  if (!city?.trim() || !slug?.trim()) {
    throw new ApiError(400, 'Hotel city and slug are required');
  }

  const encodedCity = encodeURIComponent(city.trim());
  const encodedSlug = encodeURIComponent(slug.trim());
  const raw = await unoFetch(`/v1/hotels/${encodedCity}/${encodedSlug}`, {
    query: {
      ...(checkIn ? { check_in: checkIn } : {}),
      ...(checkOut ? { check_out: checkOut } : {}),
      ...(rooms ? { rooms } : {}),
      ...(adults ? { adults } : {}),
    },
  });
  let hotel = unwrapPayload(raw);
  hotel = await applyOpsRateOverridesToHotel(hotel, { checkIn });

  return {
    ...mapHotelSummary(hotel),
    checkInTime: hotel.check_in_time,
    checkOutTime: hotel.check_out_time,
    policies: hotel.policies || {},
    photoCategories: hotel.photo_categories || [],
    rooms: (hotel.rooms || []).map(mapRoom),
  };
}

module.exports = {
  listUnoHotels,
  getUnoHotelDetail,
  buildMealPlanOptions,
  mapHotelSummary,
  mapRoom,
  pickExtraBedNightRate,
};
