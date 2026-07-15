const ApiError = require('../utils/apiError');
const { inferCityFromDestination, matchesDestination } = require('../utils/destinationMatch');
const cacheService = require('./cacheService');
const {
  unwrapPayload,
  sanitizeImageUrl,
  sanitizeImages,
  unoFetch,
} = require('./unoHotelsApiClient');

const LIST_CACHE_TTL_MS = 10 * 60 * 1000;
const DETAIL_CACHE_TTL_MS = 15 * 60 * 1000;
const TOTAL_CACHE_TTL_MS = 10 * 60 * 1000;

function parseDurationDays(pkg = {}) {
  if (pkg.duration_days > 0) return pkg.duration_days;
  const match = String(pkg.duration_label || '').match(/(\d+)\s*D/i);
  return match ? Number(match[1]) : 1;
}

function parseDurationNights(pkg = {}) {
  if (pkg.duration_nights > 0) return pkg.duration_nights;
  const match = String(pkg.duration_label || '').match(/(\d+)\s*N/i);
  if (match) return Number(match[1]);
  return Math.max(0, parseDurationDays(pkg) - 1);
}

function mapItineraryDays(days = []) {
  return days.map((day) => {
    const activityParts = [day.arrival, day.transport, day.cab_name, day.transport_mode].filter(Boolean);
    const sightseeing = formatNamedList(day.sightseeing || []);
    return {
      id: day.id || `day-${day.day_number}`,
      day: day.day_number,
      title: String(day.title || `Day ${day.day_number}`).trim(),
      description: String(day.description || day.location || '').trim(),
      hotel: day.hotel_name || '',
      activities: activityParts.length ? activityParts.join(' · ') : sightseeing,
      sightseeing,
      meals: Array.isArray(day.meals_selected) && day.meals_selected.length
        ? day.meals_selected.join(', ')
        : day.dinner || '',
      transport: day.transport || day.cab_name || day.transport_mode || '',
      accommodation: day.hotel_name || '',
      dayImage: sanitizeImageUrl(day.day_image),
      dayImages: sanitizeImages(day.day_images || []),
    };
  });
}

function pickHotelLabel(option = {}) {
  return (
    option.name ||
    option.hotel_name ||
    option.title ||
    option.hotelName ||
    option.tier_name ||
    ''
  );
}

function formatMealsLabel(meals = {}) {
  if (typeof meals === 'string') return meals.trim();
  const selected = [];
  if (meals.breakfast) selected.push('Breakfast');
  if (meals.lunch) selected.push('Lunch');
  if (meals.dinner) selected.push('Dinner');
  return selected.join(', ');
}

function formatNamedList(items = []) {
  return items
    .map((item) => item?.name || item?.title || (typeof item === 'string' ? item : ''))
    .filter(Boolean)
    .join(' · ');
}

function pickDefaultHotelOption(options = []) {
  return options.find((option) => option.is_default || option.isDefault || option.is_selected) || options[0] || null;
}

function mapHotelMeta(option = {}) {
  if (!option || typeof option !== 'object') return null;
  const name = pickHotelLabel(option);
  if (!name) return null;
  const image = sanitizeImageUrl(
    option.image_url || option.image || option.featured_image || option.thumbnail || option.cover_image
  );
  return {
    id: option.id || option.hotel_id || name,
    name,
    image,
    images: sanitizeImages(option.images || (image ? [image] : [])),
    starRating: Number(option.star_rating || option.stars || option.rating || 0),
    location: option.location || option.city || option.area || '',
    meals: formatMealsLabel(option.meals),
    priceDelta: Number(option.price_delta || option.price || 0),
    tierName: option.tier_name || option.room_type || '',
    isDefault: Boolean(option.is_default || option.isDefault || option.is_selected),
  };
}

function mergeDayItinerary(itineraryDay = {}, optionDay = {}) {
  const dayNumber = itineraryDay.day_number || optionDay.day_number;
  const hotelOptionsRaw = Array.isArray(optionDay.hotel_options) ? optionDay.hotel_options : [];
  const hotelOptions = hotelOptionsRaw.map(mapHotelMeta).filter(Boolean);
  const defaultHotelMeta =
    hotelOptions.find((o) => o.isDefault) || hotelOptions[0] || null;
  const defaultHotelName = defaultHotelMeta?.name || itineraryDay.hotel_name || '';

  const sightseeing = formatNamedList(optionDay.sightseeing || []);
  const activitiesFromOptions = formatNamedList(optionDay.activities || []);
  const legacyActivityParts = [
    itineraryDay.arrival,
    itineraryDay.transport,
    itineraryDay.cab_name,
    itineraryDay.transport_mode,
  ].filter(Boolean);
  const legacyActivities = legacyActivityParts.join(' · ');
  const activities = [activitiesFromOptions, legacyActivities].filter(Boolean).join(' · ');

  const meals =
    defaultHotelMeta?.meals ||
    (Array.isArray(itineraryDay.meals_selected) ? itineraryDay.meals_selected.join(', ') : '') ||
    itineraryDay.dinner ||
    '';

  const transport = itineraryDay.transport || itineraryDay.cab_name || itineraryDay.transport_mode || '';

  return {
    id: itineraryDay.id || optionDay.id || `day-${dayNumber}`,
    day: dayNumber,
    title: String(itineraryDay.title || optionDay.title || `Day ${dayNumber}`).trim(),
    description: String(
      itineraryDay.description
      || optionDay.description
      || optionDay.location
      || ''
    ).trim(),
    hotel: defaultHotelName,
    accommodation: defaultHotelName,
    hotelMeta: defaultHotelMeta,
    hotelOptions,
    activities: activities || sightseeing,
    sightseeing,
    meals,
    transport,
    dayImage: sanitizeImageUrl(itineraryDay.day_image || optionDay.day_image),
    dayImages: sanitizeImages(itineraryDay.day_images || optionDay.day_images || []),
  };
}

function buildMergedItinerary(itineraryDays = [], optionDays = []) {
  const itineraryByDay = new Map(
    (Array.isArray(itineraryDays) ? itineraryDays : []).map((day) => [day.day_number, day])
  );
  const optionByDay = new Map(
    (Array.isArray(optionDays) ? optionDays : []).map((day) => [day.day_number, day])
  );
  const dayNumbers = [...new Set([...itineraryByDay.keys(), ...optionByDay.keys()])]
    .filter(Boolean)
    .sort((a, b) => a - b);

  if (!dayNumbers.length) return [];

  return dayNumbers.map((dayNumber) =>
    mergeDayItinerary(itineraryByDay.get(dayNumber) || {}, optionByDay.get(dayNumber) || { day_number: dayNumber })
  );
}

function mapDayOptionsToItinerary(days = []) {
  return buildMergedItinerary([], days);
}

async function fetchUnoPackageDayOptionsPayload(slug) {
  const payload = await unoFetch(`/v1/packages/${encodeURIComponent(slug)}/day-options`);
  return unwrapPayload(payload);
}

function mapPackageCab(cab = {}) {
  return {
    id: cab.id,
    packageCabId: cab.id,
    cabTypeId: cab.cab_type_id || null,
    name: cab.name || 'Cab',
    vehicleType: cab.name || 'Cab',
    cabCategory: cab.name || '',
    seatingCapacity: cab.seats,
    description: cab.description || '',
    featuredImage: sanitizeImageUrl(cab.image_url),
    cost: Number(cab.price_delta || 0),
    totalAmount: Number(cab.price_delta || 0),
    priceDelta: Number(cab.price_delta || 0),
    isDefault: Boolean(cab.is_default),
    isPopular: Boolean(cab.is_popular),
    isActive: cab.is_active !== false,
    externalSource: 'uno_package',
    isPackageCab: true,
    tripType: 'full_day',
  };
}

async function fetchUnoPackageDayOptions(slug) {
  const payload = await fetchUnoPackageDayOptionsPayload(slug);
  if (Array.isArray(payload?.days)) return payload.days;
  if (Array.isArray(payload?.data?.days)) return payload.data.days;
  return [];
}

async function attachItineraryFromDayOptions(mapped, slug, itineraryDaysFromPackage = []) {
  if (!slug) return mapped;

  const packageItineraryDays = Array.isArray(itineraryDaysFromPackage) ? itineraryDaysFromPackage : [];

  try {
    const payload = await fetchUnoPackageDayOptionsPayload(slug);
    mapped._apiRaw = { ...(mapped._apiRaw || {}), dayOptions: payload };
    const days = Array.isArray(payload?.days) ? payload.days : [];
    const packageCabs = (Array.isArray(payload?.cabs) ? payload.cabs : [])
      .filter((cab) => cab.is_active !== false)
      .map(mapPackageCab)
      .sort((a, b) => {
        if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
        return (a.priceDelta || 0) - (b.priceDelta || 0);
      });

    if (packageCabs.length) mapped.packageCabs = packageCabs;

    if (days.length > 0 || packageItineraryDays.length > 0) {
      mapped.itinerary = buildMergedItinerary(packageItineraryDays, days);
      return mapped;
    }
  } catch {
    /* fall back to itinerary_days or generated days */
  }

  if (packageItineraryDays.length > 0) {
    mapped.itinerary = mapItineraryDays(packageItineraryDays);
  }

  return mapped;
}

function buildFallbackItinerary(pkg, destination) {
  const days = parseDurationDays(pkg);
  return Array.from({ length: days }, (_, index) => {
    const day = index + 1;
    return {
      id: `day-${pkg.id || pkg.slug || 'pkg'}-${day}`,
      day,
      title: day === 1 ? `Arrival in ${destination}` : `Day ${day} in ${destination}`,
      description: pkg.short_description || pkg.description || '',
      hotel: '',
      activities: '',
      meals: 'Breakfast',
      transport: 'Private Cab',
      accommodation: '',
      dayImage: '',
      dayImages: [],
    };
  });
}

function mapUnoPackage(pkg, { includeItinerary = false, includeDetail = false } = {}) {
  const destination =
    pkg.destination_city ||
    pkg.destination_name ||
    [pkg.state, pkg.country].filter(Boolean).join(', ') ||
    'India';

  const duration = parseDurationDays(pkg);
  const durationNights = parseDurationNights(pkg);

  const mapped = {
    _id: pkg.id,
    id: pkg.id,
    slug: pkg.slug,
    packageCode: pkg.package_code || '',
    name: pkg.name,
    destination,
    destinationName: pkg.destination_name || destination,
    state: pkg.state || '',
    country: pkg.country || 'India',
    duration,
    durationNights,
    durationLabel: pkg.duration_label || `${duration}D / ${durationNights}N`,
    startingPrice: Number(pkg.discounted_price ?? pkg.base_price ?? 0),
    basePrice: Number(pkg.base_price ?? 0),
    discountedPrice: pkg.discounted_price != null ? Number(pkg.discounted_price) : null,
    packageType: pkg.tour_type || 'domestic',
    currency: pkg.currency || 'INR',
    coverImage: sanitizeImageUrl(pkg.featured_image),
    shortDescription: pkg.short_description || '',
    description: pkg.description || '',
    inclusions: pkg.inclusions || [],
    exclusions: pkg.exclusions || [],
    highlights: pkg.highlight_icons || [],
    externalSource: 'uno_hotels',
    status: pkg.status,
    bookingCount: Number(pkg.booking_count || 0),
    avgRating: Number(pkg.avg_rating || 0),
    reviewCount: Number(pkg.review_count || 0),
    isFeatured: Boolean(pkg.is_featured),
    isCustomizable: Boolean(pkg.is_customizable),
    seoScore: Number(pkg.seo_score || 0),
    updatedAt: pkg.updated_at || null,
    createdAt: pkg.created_at || null,
  };

  if (includeDetail) {
    mapped.galleryImages = sanitizeImages(pkg.gallery_images || []);
    mapped.remarks = pkg.remarks || [];
    mapped.termsConditions = pkg.terms_conditions || [];
    mapped.cancellationPolicy = pkg.cancellation_policy || [];
    mapped.faqs = Array.isArray(pkg.faqs)
      ? pkg.faqs.map((faq) => ({
          question: faq.question || '',
          answer: faq.answer || '',
        }))
      : [];
  }

  if (includeItinerary) {
    const itineraryDays = Array.isArray(pkg.itinerary_days) ? pkg.itinerary_days : [];
    mapped.itinerary =
      itineraryDays.length > 0
        ? mapItineraryDays(itineraryDays)
        : buildFallbackItinerary(pkg, destination);
  }

  return mapped;
}

/** UNO public packages API rejects limit > 50 (returns 422). */
const UNO_API_MAX_LIMIT = 50;

function buildListCacheKey(query = {}) {
  const normalized = {
    page: Number(query.page) || 1,
    limit: Math.min(Number(query.limit) || UNO_API_MAX_LIMIT, UNO_API_MAX_LIMIT),
    search: query.search || '',
    destination: query.destination || '',
    status: query.status || 'published',
    tour_type: query.tour_type || '',
    destination_id: query.destination_id || '',
  };
  return `uno:packages:list:${JSON.stringify(normalized)}`;
}

async function fetchUnoPackages(query = {}) {
  const limit = Math.min(Number(query.limit) || UNO_API_MAX_LIMIT, UNO_API_MAX_LIMIT);
  const rawSearch = query.search || inferCityFromDestination(query.destination) || '';
  const search = String(rawSearch).trim().toLowerCase();
  const page = Math.max(1, Number(query.page) || 1);
  const payload = await unoFetch('/v1/packages', {
    query: {
      page,
      limit,
      search: search || undefined,
      tour_type: query.tour_type || undefined,
      destination_id: query.destination_id || undefined,
    },
  });
  const unwrapped = unwrapPayload(payload);

  const items = (unwrapped.items || []).map((pkg) => mapUnoPackage(pkg));
  const filtered = query.destination
    ? items.filter((pkg) => matchesDestination(pkg, query.destination))
    : items;
  const total = query.destination ? filtered.length : Number(unwrapped.total ?? filtered.length);
  const totalPages = query.destination
    ? 1
    : Number(unwrapped.total_pages ?? Math.max(1, Math.ceil(total / limit)));

  return {
    items: filtered,
    total,
    page: unwrapped.page ?? page,
    limit: unwrapped.limit ?? limit,
    totalPages,
    source: 'uno_hotels_public',
    destination: query.destination || null,
  };
}

async function listUnoPackages(query = {}) {
  return cacheService.getOrSet(
    buildListCacheKey(query),
    () => fetchUnoPackages(query),
    LIST_CACHE_TTL_MS
  );
}

async function fetchUnoPackageById(packageId) {
  const key = String(packageId || '').trim();
  if (!key) throw new ApiError(400, 'Package id is required');

  let mapped = null;
  let rawPackageApi = null;
  let slug = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(key) ? '' : key;

  // UNO detail endpoint accepts slug; UUID id returns 404.
  try {
    const detail = await unoFetch(`/v1/packages/${encodeURIComponent(key)}`);
    rawPackageApi = unwrapPayload(detail);
    slug = rawPackageApi.slug || slug;
    mapped = mapUnoPackage(rawPackageApi, { includeDetail: true });
  } catch (err) {
    if (err.statusCode !== 404) throw err;
  }

  if (!mapped) {
    const list = await fetchUnoPackages({ limit: UNO_API_MAX_LIMIT, page: 1 });
    const summary = list.items.find(
      (item) => item.id === key || item._id === key || item.slug === key
    );
    if (!summary) throw new ApiError(404, 'Package not found in Uno Hotels catalog');

    slug = summary.slug || slug;

    if (summary.slug && summary.slug !== key) {
      try {
        const detail = await unoFetch(`/v1/packages/${encodeURIComponent(summary.slug)}`);
        rawPackageApi = unwrapPayload(detail);
        slug = rawPackageApi.slug || summary.slug;
        mapped = mapUnoPackage(rawPackageApi, { includeDetail: true });
      } catch {
        /* fall back to summary */
      }
    }

    if (!mapped) {
      mapped = mapUnoPackage(
        {
          ...summary,
          id: summary.id || summary._id,
          slug: summary.slug,
          duration_days: summary.duration,
          duration_nights: summary.durationNights,
          duration_label: summary.durationLabel,
          base_price: summary.basePrice,
          tour_type: summary.packageType,
          destination_city: summary.destination,
        },
        { includeDetail: true }
      );
    }
  }

  mapped = await attachItineraryFromDayOptions(
    mapped,
    slug || mapped.slug,
    rawPackageApi?.itinerary_days || []
  );

  if (!mapped.itinerary?.length) {
    const destination = mapped.destination || 'India';
    mapped.itinerary = buildFallbackItinerary(
      {
        id: mapped.id,
        slug: mapped.slug,
        duration_days: mapped.duration,
        short_description: mapped.shortDescription,
        description: mapped.description,
      },
      destination
    );
  }

  if (rawPackageApi) {
    mapped._apiRaw = { ...(mapped._apiRaw || {}), package: rawPackageApi };
  }

  return mapped;
}

async function getUnoPackageById(packageId) {
  return cacheService.getOrSet(
    `uno:packages:detail:v2:${packageId}`,
    () => fetchUnoPackageById(packageId),
    DETAIL_CACHE_TTL_MS
  );
}

async function getUnoPackagesTotal() {
  return cacheService.getOrSet(
    'uno:packages:total',
    async () => {
      const result = await fetchUnoPackages({ limit: 1, page: 1 });
      return Number(result.total || 0);
    },
    TOTAL_CACHE_TTL_MS
  );
}

module.exports = {
  listUnoPackages,
  getUnoPackageById,
  getUnoPackagesTotal,
  mapUnoPackage,
};
