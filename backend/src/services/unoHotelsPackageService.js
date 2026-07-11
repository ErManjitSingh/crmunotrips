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
    return {
      id: day.id || `day-${day.day_number}`,
      day: day.day_number,
      title: day.title || `Day ${day.day_number}`,
      description: day.description || '',
      hotel: day.hotel_name || '',
      activities: activityParts.length ? activityParts.join(' · ') : '',
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

function mapDayOptionsToItinerary(days = []) {
  return days.map((day) => {
    const hotelOptions = Array.isArray(day.hotel_options) ? day.hotel_options : [];
    const defaultHotel =
      pickHotelLabel(hotelOptions.find((option) => option.is_default || option.isDefault || option.is_selected))
      || pickHotelLabel(hotelOptions[0])
      || '';

    const sightseeing = (Array.isArray(day.sightseeing) ? day.sightseeing : [])
      .map((spot) => spot.name)
      .filter(Boolean);
    const activities = (Array.isArray(day.activities) ? day.activities : [])
      .map((activity) => activity.name)
      .filter(Boolean);
    const activityText = [...sightseeing, ...activities].join(' · ');

    return {
      id: `day-${day.day_number}`,
      day: day.day_number,
      title: day.title || `Day ${day.day_number}`,
      description: day.location || '',
      hotel: defaultHotel,
      activities: activityText,
      meals: '',
      transport: '',
      accommodation: defaultHotel,
      dayImage: sanitizeImageUrl(day.day_image),
      dayImages: sanitizeImages(day.day_images || []),
    };
  });
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

async function attachItineraryFromDayOptions(mapped, slug) {
  if (!slug) return mapped;

  try {
    const payload = await fetchUnoPackageDayOptionsPayload(slug);
    const days = Array.isArray(payload?.days) ? payload.days : [];
    const packageCabs = (Array.isArray(payload?.cabs) ? payload.cabs : [])
      .filter((cab) => cab.is_active !== false)
      .map(mapPackageCab)
      .sort((a, b) => {
        if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
        return (a.priceDelta || 0) - (b.priceDelta || 0);
      });

    if (packageCabs.length) mapped.packageCabs = packageCabs;

    if (days.length > 0) {
      mapped.itinerary = mapDayOptionsToItinerary(days);
      return mapped;
    }
  } catch {
    /* fall back to itinerary_days or generated days */
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
  let slug = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(key) ? '' : key;

  // UNO detail endpoint accepts slug; UUID id returns 404.
  try {
    const detail = await unoFetch(`/v1/packages/${encodeURIComponent(key)}`);
    const raw = unwrapPayload(detail);
    slug = raw.slug || slug;
    mapped = mapUnoPackage(raw, { includeDetail: true });
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
        const raw = unwrapPayload(detail);
        slug = raw.slug || summary.slug;
        mapped = mapUnoPackage(raw, { includeDetail: true });
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

  mapped = await attachItineraryFromDayOptions(mapped, slug || mapped.slug);

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

  return mapped;
}

async function getUnoPackageById(packageId) {
  return cacheService.getOrSet(
    `uno:packages:detail:${packageId}`,
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
