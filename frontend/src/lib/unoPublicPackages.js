const UNO_PUBLIC_API_BASE = 'https://api.unohotelsandresorts.com';

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

  const pkgDestination = String(pkg.destination || pkg.destinationName || pkg.destination_name || pkg.destination_city || '').trim();
  if (!pkgDestination) return true;

  const terms = text
    .split(/[,|/]/)
    .map((part) => normalize(part.replace(/\s+india$/i, '')))
    .filter((part) => part.length >= 3);

  const haystack = normalize(
    [pkgDestination, pkg.name, pkg.destinationName].filter(Boolean).join(' ')
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
    [raw.state, raw.country].filter(Boolean).join(', ') ||
    'India';

  const mapped = {
    _id: raw.id,
    id: raw.id,
    slug: raw.slug,
    packageCode: raw.package_code || '',
    name: raw.name || '',
    destination,
    destinationName: raw.destination_name || destination,
    state: raw.state || '',
    country: raw.country || 'India',
    duration,
    durationNights,
    durationLabel: raw.duration_label || `${duration}D / ${durationNights}N`,
    startingPrice: toNumber(raw.discounted_price ?? raw.base_price, 0),
    basePrice: toNumber(raw.base_price, 0),
    discountedPrice: raw.discounted_price == null ? null : toNumber(raw.discounted_price, 0),
    packageType: raw.tour_type || 'domestic',
    currency: raw.currency || 'INR',
    coverImage: raw.featured_image || '',
    shortDescription: raw.short_description || '',
    description: raw.description || '',
    inclusions: Array.isArray(raw.inclusions) ? raw.inclusions : [],
    exclusions: Array.isArray(raw.exclusions) ? raw.exclusions : [],
    externalSource: 'uno_hotels',
    status: raw.status,
    bookingCount: toNumber(raw.booking_count, 0),
    avgRating: toNumber(raw.avg_rating, 0),
    reviewCount: toNumber(raw.review_count, 0),
    isFeatured: Boolean(raw.is_featured),
    isCustomizable: Boolean(raw.is_customizable),
  };

  if (includeDetail) {
    mapped.galleryImages = Array.isArray(raw.gallery_images) ? raw.gallery_images : [];
    mapped.remarks = Array.isArray(raw.remarks) ? raw.remarks : [];
    mapped.termsConditions = Array.isArray(raw.terms_conditions) ? raw.terms_conditions : [];
    mapped.cancellationPolicy = Array.isArray(raw.cancellation_policy) ? raw.cancellation_policy : [];
    mapped.faqs = Array.isArray(raw.faqs) ? raw.faqs : [];
    mapped.itinerary = Array.isArray(raw.itinerary_days)
      ? raw.itinerary_days.map((day) => ({
          id: day.id || `day-${day.day_number}`,
          day: day.day_number,
          title: day.title || `Day ${day.day_number}`,
          description: day.description || '',
          hotel: day.hotel_name || '',
          activities: [day.arrival, day.transport].filter(Boolean).join(' · '),
          meals: Array.isArray(day.meals_selected) ? day.meals_selected.join(', ') : day.dinner || '',
          transport: day.transport || day.cab_name || day.transport_mode || '',
          accommodation: day.hotel_name || '',
          dayImage: day.day_image || '',
          dayImages: Array.isArray(day.day_images) ? day.day_images : [],
        }))
      : [];
  }

  return mapped;
}

function inferCityFromDestination(destination = '') {
  const text = String(destination || '').trim();
  if (!text) return '';

  const firstPart = text.split(',')[0]?.trim() || text;
  return (
    firstPart
      .replace(
        /\s+(India|Himachal Pradesh|Uttarakhand|Rajasthan|Kerala|Goa|Punjab|Delhi)$/i,
        ''
      )
      .trim() || firstPart
  );
}

export async function fetchUnoPublicPackages({ page = 1, limit = 50, search = '', destination = '' } = {}) {
  const url = new URL('/v1/packages', UNO_PUBLIC_API_BASE);
  url.searchParams.set('page', String(page));
  url.searchParams.set('limit', String(limit));

  const effectiveSearch = search || (destination ? inferCityFromDestination(destination) : '');
  if (effectiveSearch) url.searchParams.set('search', effectiveSearch);

  const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('Failed to fetch public packages');
  const json = await res.json();
  const items = Array.isArray(json?.items) ? json.items : [];
  const mapped = items.map((item) => mapUnoPackage(item));
  const filtered = destination ? mapped.filter((pkg) => matchesDestination(pkg, destination)) : mapped;

  return {
    items: filtered,
    total: destination ? filtered.length : toNumber(json?.total, filtered.length),
    page: toNumber(json?.page, page),
    totalPages: toNumber(json?.total_pages, 1),
  };
}

export async function fetchUnoPublicPackageDetail(idOrSlug) {
  const key = String(idOrSlug || '').trim();
  if (!key) throw new Error('Package id is required');

  const detailUrl = new URL(`/v1/packages/${encodeURIComponent(key)}`, UNO_PUBLIC_API_BASE);
  const detailRes = await fetch(detailUrl.toString(), { headers: { Accept: 'application/json' } });
  if (detailRes.ok) {
    const detail = await detailRes.json();
    return mapUnoPackage(detail, { includeDetail: true });
  }

  const list = await fetchUnoPublicPackages({ limit: 100, page: 1 });
  const fallback = list.items.find(
    (p) => p._id === key || p.id === key || p.slug === key || p.packageCode === key
  );
  if (!fallback) throw new Error('Package detail not found');

  if (fallback.slug && fallback.slug !== key) {
    try {
      return await fetchUnoPublicPackageDetail(fallback.slug);
    } catch {
      /* use summary */
    }
  }

  return fallback;
}

