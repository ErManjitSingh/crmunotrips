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

/**
 * Partial / keyword match on package name (and related fields).
 * Every whitespace-separated token must appear somewhere in the package text.
 */
export function matchesPackageNameSearch(pkg = {}, search = '') {
  const q = String(search || '').trim().toLowerCase();
  if (!q) return true;
  const tokens = q.split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;

  const hayRaw = [
    pkg.name,
    pkg.title,
    pkg.destination,
    pkg.destinationName,
    pkg.state,
    pkg.shortDescription,
    pkg.description,
    pkg.packageCode,
    pkg.slug,
    pkg.code,
  ]
    .map((x) => String(x || ''))
    .join(' ');
  const hay = hayRaw.toLowerCase();
  const hayNorm = normalize(hayRaw);
  return tokens.every((token) => {
    const t = token.toLowerCase();
    const tn = normalize(t);
    return hay.includes(t) || (tn && hayNorm.includes(tn));
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
 *
 * When `destination` is set, UNO is queried by destination family (not the typed name).
 * Typed `search` then filters locally so any keyword in the package name matches.
 */
export async function fetchUnoPublicPackages({ page = 1, limit = 50, search = '', destination = '' } = {}) {
  const safeLimit = Math.min(Number(limit) || UNO_PACKAGES_MAX_LIMIT, UNO_PACKAGES_MAX_LIMIT);
  const nameSearch = String(search || '').trim();
  const destApiSearch = destination
    ? String(preferredDestinationSearch(destination) || destination).trim().toLowerCase()
    : '';
  // Never let a typed package-name keyword replace destination catalog search
  const apiSearch = (destApiSearch || nameSearch).trim().toLowerCase();

  const fetchPage = async (pageNum) => {
    const { data } = await API.get('/uno-packages', {
      params: {
        page: pageNum,
        limit: safeLimit,
        search: apiSearch || undefined,
        destination: destination || undefined,
      },
      skipErrorToast: true,
    });
    return data || {};
  };

  const first = await fetchPage(Math.max(1, Number(page) || 1));
  let items = Array.isArray(first.items) ? first.items.map((item) => mapUnoPackage(item)) : [];

  // Destination catalogs: pull a few pages so name search can see more than page 1
  if (destination) {
    const totalPages = Math.min(Math.max(1, Number(first.totalPages) || 1), 5);
    for (let p = 2; p <= totalPages; p += 1) {
      const next = await fetchPage(p);
      const batch = Array.isArray(next.items) ? next.items.map((item) => mapUnoPackage(item)) : [];
      items = items.concat(batch);
    }
  }

  let filtered = destination
    ? items.filter((pkg) => matchesDestination(pkg, destination))
    : items;

  if (nameSearch) {
    filtered = filtered.filter((pkg) => matchesPackageNameSearch(pkg, nameSearch));
  }

  // De-dupe by id after multi-page merge
  const seen = new Set();
  filtered = filtered.filter((pkg) => {
    const key = String(pkg._id || pkg.id || pkg.slug || pkg.name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    items: filtered,
    total: destination || nameSearch ? filtered.length : toNumber(first.total, filtered.length),
    page: destination ? 1 : toNumber(first.page, page),
    totalPages: destination || nameSearch ? 1 : toNumber(first.totalPages, 1),
    source: first.source || 'uno_hotels_public',
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
