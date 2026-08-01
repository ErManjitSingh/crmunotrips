import API from '../api/axios';
import { resolvePackageCabs } from './packageCabMapper';
import { buildMergedItinerary, resolvePackageItinerary } from './packageItineraryMapper';
import { expandDestinationMatchTerms, preferredDestinationSearch } from './destinationFamilies';

/** Source of truth for UNO package catalog (proxied via CRM /api/uno-packages). */
export const UNO_PACKAGES_API_URL = 'https://api.unohotelsandresorts.com/v1/packages';

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function parseDurationDays(pkg = {}) {
  if (toNumber(pkg.duration_days, 0) > 0) return toNumber(pkg.duration_days, 1);
  const match = String(pkg.duration_label || '').match(/(\d+)\s*D/i);
  return match ? Number(match[1]) : 1;
}

function parseDurationNights(pkg = {}) {
  if (toNumber(pkg.duration_nights, 0) > 0) return toNumber(pkg.duration_nights, 1);
  const match = String(pkg.duration_label || '').match(/(\d+)\s*N/i);
  if (match) return Number(match[1]);
  return Math.max(0, parseDurationDays(pkg) - 1);
}

function normalize(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchesDestination(pkg = {}, destination = '') {
  const text = String(destination || '').trim();
  if (!text) return true;

  const pkgDestination = String(
    pkg.destination || pkg.destinationName || pkg.destination_name || pkg.destination_city || ''
  ).trim();
  const pkgState = String(pkg.state || '').trim();
  if (!pkgDestination && !pkgState) return true;

  const terms = expandDestinationMatchTerms(text);
  const haystack = normalize(
    [pkgDestination, pkgState, pkg.name, pkg.destinationName].filter(Boolean).join(' ')
  );
  return terms.some((term) => {
    if (haystack.includes(term) || term.includes(haystack)) return true;
    const cityToken = term.split(' ')[0];
    return cityToken.length >= 3 && haystack.includes(cityToken);
  });
}

export function mapUnoPackage(raw = {}, { includeDetail = false } = {}) {
  const duration = parseDurationDays(raw);
  const durationNights = parseDurationNights(raw);
  const destination =
    raw.destination_city ||
    raw.destination_name ||
    raw.destination ||
    [raw.state, raw.country].filter(Boolean).join(', ') ||
    'India';

  const mapped = {
    _id: raw.id || raw._id,
    id: raw.id || raw._id,
    slug: raw.slug,
    packageCode: raw.package_code || raw.packageCode || '',
    name: raw.name || '',
    destination,
    destinationName: raw.destination_name || raw.destinationName || destination,
    state: raw.state || '',
    country: raw.country || 'India',
    duration: raw.duration || duration,
    durationNights: raw.durationNights || durationNights,
    durationLabel: raw.duration_label || raw.durationLabel || `${duration}D / ${durationNights}N`,
    startingPrice: toNumber(
      raw.startingPrice ?? raw.discounted_price ?? raw.discountedPrice ?? raw.base_price ?? raw.basePrice,
      0
    ),
    baseStartingPrice: toNumber(
      raw.baseStartingPrice ?? raw.discounted_price ?? raw.discountedPrice ?? raw.base_price ?? raw.basePrice ?? raw.startingPrice,
      0
    ),
    basePrice: toNumber(raw.basePrice ?? raw.base_price, 0),
    discountedPrice: raw.discounted_price == null && raw.discountedPrice == null
      ? null
      : toNumber(raw.discountedPrice ?? raw.discounted_price, 0),
    destinationMarginPercent: toNumber(raw.destinationMarginPercent, 0),
    destinationMarginApplied: Boolean(raw.destinationMarginApplied),
    destinationMarginName: raw.destinationMarginName || '',
    packageType: raw.tour_type || raw.packageType || 'domestic',
    currency: raw.currency || 'INR',
    coverImage: raw.featured_image || raw.coverImage || '',
    shortDescription: raw.short_description || raw.shortDescription || '',
    description: raw.description || '',
    inclusions: Array.isArray(raw.inclusions) ? raw.inclusions : [],
    exclusions: Array.isArray(raw.exclusions) ? raw.exclusions : [],
    externalSource: 'uno_hotels',
    status: raw.status,
    bookingCount: toNumber(raw.booking_count ?? raw.bookingCount, 0),
    avgRating: toNumber(raw.avg_rating ?? raw.avgRating, 0),
    reviewCount: toNumber(raw.review_count ?? raw.reviewCount, 0),
    isFeatured: Boolean(raw.is_featured ?? raw.isFeatured),
    isCustomizable: Boolean(raw.is_customizable ?? raw.isCustomizable),
  };

  if (raw._apiRaw) mapped._apiRaw = raw._apiRaw;

  if (includeDetail || raw.itinerary?.length || raw.itinerary_days?.length) {
    mapped.galleryImages = Array.isArray(raw.gallery_images || raw.galleryImages)
      ? raw.gallery_images || raw.galleryImages
      : [];
    mapped.remarks = raw.remarks || [];
    mapped.termsConditions = raw.terms_conditions || raw.termsConditions || [];
    mapped.cancellationPolicy = raw.cancellation_policy || raw.cancellationPolicy || [];
    mapped.faqs = Array.isArray(raw.faqs) ? raw.faqs : [];
    mapped.packageCabs = resolvePackageCabs({
      packageCabs: raw.packageCabs,
      package_cabs: raw.package_cabs,
      _apiRaw: raw._apiRaw,
    });
    mapped.itinerary = Array.isArray(raw.itinerary) && raw.itinerary.length
      ? raw.itinerary
      : Array.isArray(raw.itinerary_days) && raw.itinerary_days.length
        ? buildMergedItinerary(
            raw.itinerary_days,
            raw._apiRaw?.dayOptions?.days || [],
            raw._apiRaw?.dayOptions?.stays || []
          )
        : [];
  }

  return mapped;
}

/** UNO API max page size (higher values return HTTP 422). */
export const UNO_PACKAGES_MAX_LIMIT = 50;

/**
 * Fetch packages from UNO Hotels API (https://api.unohotelsandresorts.com/v1/packages)
 * via CRM backend proxy /api/uno-packages — never call UNO from the browser (CORS).
 */
export async function fetchUnoPublicPackages({ page = 1, limit = 50, search = '', destination = '' } = {}) {
  const safeLimit = Math.min(Number(limit) || UNO_PACKAGES_MAX_LIMIT, UNO_PACKAGES_MAX_LIMIT);
  const effectiveSearch = (
    search || (destination ? preferredDestinationSearch(destination) : '')
  )
    .trim()
    .toLowerCase();

  const { data } = await API.get('/uno-packages', {
    params: {
      page,
      limit: safeLimit,
      search: effectiveSearch || undefined,
      destination: destination || undefined,
    },
    skipErrorToast: true,
  });

  const items = Array.isArray(data?.items) ? data.items.map((item) => mapUnoPackage(item)) : [];
  // Client-side family match (state ↔ cities) in case API search was narrow
  const filtered = destination
    ? items.filter((pkg) => matchesDestination(pkg, destination))
    : items;
  return {
    items: filtered,
    total: toNumber(data?.total, filtered.length),
    page: toNumber(data?.page, page),
    totalPages: toNumber(data?.totalPages, 1),
    source: data?.source || 'uno_hotels_public',
  };
}

export async function fetchUnoPublicPackageDetail(idOrSlug) {
  const key = String(idOrSlug || '').trim();
  if (!key) throw new Error('Package id is required');

  const { data } = await API.get(`/uno-packages/${encodeURIComponent(key)}`, {
    skipErrorToast: true,
  });

  return mapUnoPackage(data, { includeDetail: true });
}
