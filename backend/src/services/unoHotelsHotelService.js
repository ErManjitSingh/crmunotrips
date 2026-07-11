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

function buildMealPlanOptions(mealPlans = {}) {
  const breakfast = Number(mealPlans.breakfast) || 0;
  const lunch = Number(mealPlans.lunch) || 0;
  const dinner = Number(mealPlans.dinner) || 0;

  return [
    { key: 'ep', label: 'EP (Room Only)', price: 0, meals: [] },
    { key: 'cp', label: 'CP — Breakfast', price: breakfast, meals: ['breakfast'] },
    { key: 'map', label: 'MAP — Breakfast + Dinner', price: breakfast + dinner, meals: ['breakfast', 'dinner'] },
    { key: 'ap', label: 'AP — All Meals', price: breakfast + lunch + dinner, meals: ['breakfast', 'lunch', 'dinner'] },
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
    pricePerNight: Number(room.price_per_night || 0),
    available: room.available !== false,
    availableCount: room.available_count,
    mealPlanOptions: buildMealPlanOptions(room.meal_plans),
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

async function getUnoHotelDetail({ city, slug }) {
  if (!city?.trim() || !slug?.trim()) {
    throw new ApiError(400, 'Hotel city and slug are required');
  }

  const encodedCity = encodeURIComponent(city.trim());
  const encodedSlug = encodeURIComponent(slug.trim());
  const raw = await unoFetch(`/v1/hotels/${encodedCity}/${encodedSlug}`);
  const hotel = unwrapPayload(raw);

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
};
