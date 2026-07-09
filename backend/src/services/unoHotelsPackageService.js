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
  return days.map((day) => ({
    id: day.id || `day-${day.day_number}`,
    day: day.day_number,
    title: day.title || `Day ${day.day_number}`,
    description: day.description || '',
    hotel: day.hotel_name || '',
    activities: [day.arrival, day.transport].filter(Boolean).join(' · '),
    meals: Array.isArray(day.meals_selected) && day.meals_selected.length
      ? day.meals_selected.join(', ')
      : day.dinner || '',
    transport: day.transport || day.cab_name || day.transport_mode || '',
    accommodation: day.hotel_name || '',
    dayImage: sanitizeImageUrl(day.day_image),
    dayImages: sanitizeImages(day.day_images || []),
  }));
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

function buildListCacheKey(query = {}) {
  const normalized = {
    page: Number(query.page) || 1,
    limit: Math.min(Number(query.limit) || 50, 100),
    search: query.search || '',
    destination: query.destination || '',
    status: query.status || 'published',
    tour_type: query.tour_type || '',
    destination_id: query.destination_id || '',
  };
  return `uno:packages:list:${JSON.stringify(normalized)}`;
}

async function fetchUnoPackages(query = {}) {
  const limit = Math.min(Number(query.limit) || 50, 100);
  const search = query.search || inferCityFromDestination(query.destination) || '';
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
  const list = await fetchUnoPackages({ limit: 100, page: 1 });
  const summary = list.items.find((item) => item.id === packageId || item._id === packageId);
  if (!summary) throw new ApiError(404, 'Package not found in Uno Hotels catalog');

  if (summary.slug) {
    try {
      const detail = await unoFetch(`/v1/packages/${summary.slug}`);
      return mapUnoPackage(unwrapPayload(detail), { includeItinerary: true, includeDetail: true });
    } catch {
      /* fall back to summary */
    }
  }

  return mapUnoPackage(
    {
      ...summary,
      id: summary.id || summary._id,
      duration_days: summary.duration,
      duration_nights: summary.durationNights,
      duration_label: summary.durationLabel,
      base_price: summary.basePrice,
      tour_type: summary.packageType,
      destination_city: summary.destination,
    },
    { includeItinerary: true, includeDetail: true }
  );
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
