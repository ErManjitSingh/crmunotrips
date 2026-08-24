const ApiError = require('../utils/apiError');
const {
  preferredDestinationSearch,
  matchesDestination,
} = require('../utils/destinationMatch');
const cacheService = require('./cacheService');
const {
  unwrapPayload,
  unwrapListPayload,
  sanitizeImageUrl,
  sanitizeImages,
  unoFetch,
} = require('./unoHotelsApiClient');
const { getUnoHotelDetail, mapHotelSummary, mapRoom, pickExtraBedNightRate } = require('./unoHotelsHotelService');
const { applyOpsRateOverridesToHotel } = require('./unoHotelsOpsService');

const LIST_CACHE_TTL_MS = 10 * 60 * 1000;
const DETAIL_CACHE_TTL_MS = 15 * 60 * 1000;
const TOTAL_CACHE_TTL_MS = 10 * 60 * 1000;
const HOTEL_CITY_CACHE_TTL_MS = 15 * 60 * 1000;

/** city -> { fetchedAt, byId: Map } */
const hotelCityCache = new Map();

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

function formatMealPlanCode(code = '') {
  const key = String(code || '').trim().toLowerCase();
  const map = {
    ep: 'EP (Room only)',
    cp: 'CP (Breakfast)',
    map: 'MAP (Breakfast + Dinner)',
    ap: 'AP (All meals)',
    ai: 'AI (All inclusive)',
  };
  return map[key] || (code ? String(code).toUpperCase() : '');
}

function normalizeMealPlanKey(code = '') {
  const s = String(code || '').trim().toLowerCase();
  if (!s) return '';
  if (s === 'ep' || s.startsWith('ep') || /\bep\b/.test(s)) return 'ep';
  if (s === 'cp' || s.startsWith('cp') || /\bcp\b/.test(s)) return 'cp';
  if (s === 'map' || s.startsWith('map') || /\bmap\b/.test(s)) return 'map';
  if (s === 'ap' || s.startsWith('ap') || /\bap\b/.test(s)) return 'ap';
  if (s === 'ai' || /all\s*inclusive/.test(s)) return 'ai';
  return '';
}

/** Package stay meal (usually MAP). No-hotel / departure day → EP. */
function packageMealLabel(code = '', { hasHotel = true } = {}) {
  if (!hasHotel) return formatMealPlanCode('ep');
  return formatMealPlanCode(normalizeMealPlanKey(code) || 'map');
}

function packageMealKey(code = '', { hasHotel = true } = {}) {
  if (!hasHotel) return 'ep';
  return normalizeMealPlanKey(code) || 'map';
}

function formatNamedList(items = []) {
  return items
    .map((item) => item?.name || item?.title || (typeof item === 'string' ? item : ''))
    .filter(Boolean)
    .join(' · ');
}

function normalizeYmd(value) {
  if (!value) return '';
  const s = String(value);
  const match = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function shiftYmd(ymd, days) {
  const [y, m, d] = String(ymd || '').split('-').map(Number);
  if (!y || !m || !d) return '';
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + Number(days || 0));
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function stayCheckInOut(stay = {}, travelDate = '') {
  if (!travelDate) return {};
  const cin = Number(stay.check_in_day);
  const cout = Number(stay.check_out_day);
  if (!Number.isFinite(cin) || !Number.isFinite(cout)) return {};
  return {
    checkIn: shiftYmd(travelDate, cin - 1),
    checkOut: shiftYmd(travelDate, cout - 1),
  };
}

function stayCoversDay(stay = {}, dayNumber) {
  const cin = Number(stay.check_in_day);
  const cout = Number(stay.check_out_day);
  const day = Number(dayNumber);
  if (!Number.isFinite(cin) || !Number.isFinite(cout) || !Number.isFinite(day)) return false;
  return day >= cin && day < cout;
}

function findStayForDay(stays = [], dayNumber) {
  const list = Array.isArray(stays) ? stays.filter((s) => s?.is_active !== false) : [];
  return list.find((stay) => stayCoversDay(stay, dayNumber)) || null;
}

/**
 * Resolve package stay hotel_ids via Uno Hotels public search API
 * (https://api.unohotelsandresorts.com/docs — GET /v1/hotels/search).
 */
async function fetchHotelsForCity(city) {
  const key = String(city || '').trim().toLowerCase();
  if (!key) return new Map();

  const cached = hotelCityCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < HOTEL_CITY_CACHE_TTL_MS) {
    return cached.byId;
  }

  const byId = new Map();
  try {
    const raw = await unoFetch('/v1/hotels/search', {
      query: { city: String(city).trim(), limit: 100, sort: 'popular' },
    });
    for (const hotel of unwrapListPayload(raw)) {
      if (hotel?.id) byId.set(String(hotel.id), hotel);
    }
  } catch {
    /* city may be empty / API miss */
  }

  hotelCityCache.set(key, { fetchedAt: Date.now(), byId });
  return byId;
}

function collectStayHotelRefs(stays = []) {
  const refs = [];
  for (const stay of Array.isArray(stays) ? stays : []) {
    const city = stay.destination_city || '';
    if (stay.default_hotel_id) {
      refs.push({
        hotelId: String(stay.default_hotel_id),
        name: stay.default_hotel_name || '',
        city,
      });
    }
    for (const opt of Array.isArray(stay.hotel_options) ? stay.hotel_options : []) {
      if (!opt?.hotel_id) continue;
      refs.push({
        hotelId: String(opt.hotel_id),
        name: opt.hotel_name || '',
        city,
      });
    }
  }
  return refs;
}

async function resolveHotelCatalog(stays = []) {
  const refs = collectStayHotelRefs(stays);
  const catalog = new Map();
  if (!refs.length) return catalog;

  const cities = [...new Set(refs.map((r) => r.city).filter(Boolean))];
  await Promise.all(
    cities.map(async (city) => {
      const byId = await fetchHotelsForCity(city);
      byId.forEach((hotel, id) => catalog.set(id, hotel));
    })
  );

  const missing = refs.filter((r) => r.hotelId && !catalog.has(r.hotelId));
  await Promise.all(
    missing.map(async (ref) => {
      if (!ref.city || !ref.name) return;
      try {
        const raw = await unoFetch('/v1/hotels/search', {
          query: { city: ref.city, q: ref.name, limit: 10, sort: 'popular' },
        });
        const list = unwrapListPayload(raw);
        const hit = list.find((h) => String(h.id) === ref.hotelId) || list[0];
        if (hit?.id) catalog.set(String(hit.id === ref.hotelId ? hit.id : ref.hotelId), hit);
        if (hit?.id) catalog.set(ref.hotelId, hit);
      } catch {
        /* ignore */
      }
    })
  );

  return catalog;
}

function applyCatalogToOption(option = {}, catalog = null, stay = null) {
  const hotelId = String(option.hotel_id || option.id || '');
  const hotel = hotelId && catalog ? catalog.get(hotelId) : null;
  if (!hotel) {
    const slug = option.slug || option.hotel_slug || '';
    return {
      ...option,
      slug,
      hotel_slug: slug || option.hotel_slug || '',
      city: option.city || stay?.destination_city || '',
    };
  }

  const thumb = sanitizeImageUrl(hotel.thumbnail_url);
  const images = sanitizeImages(hotel.images || (thumb ? [thumb] : []));
  const location =
    [hotel.city, hotel.state].filter(Boolean).join(', ') ||
    option.location ||
    stay?.destination_city ||
    '';

  // Prefer dated day-options sell price (website package picker), not tax-inclusive catalog "from".
  const startingPrice = Number(
    option.starting_price ?? option.startingPrice ?? 0
  );
  // True package upgrade only — never fall back to catalog rate (that double-counts vs package baseCost).
  const priceDelta = Number(option.price_delta ?? option.upgrade_price ?? 0) || 0;
  // Day-options API uses hotel_slug; catalog uses slug — keep both so detail hydrate never misses.
  const slug = hotel.slug || option.slug || option.hotel_slug || '';

  return {
    ...option,
    hotel_id: hotelId || option.hotel_id,
    hotel_name: hotel.name || option.hotel_name,
    name: hotel.name || option.name || option.hotel_name,
    image_url: thumb || option.image_url,
    image: thumb || option.image,
    images: images.length ? images : option.images,
    star_rating: hotel.star_category ?? option.star_rating,
    stars: hotel.star_category ?? option.stars,
    rating: hotel.rating ?? option.rating,
    location,
    city: hotel.city || option.city || stay?.destination_city || '',
    slug,
    hotel_slug: slug || option.hotel_slug || '',
    amenities: hotel.amenities || option.amenities,
    address: hotel.address || option.address,
    starting_price: startingPrice,
    startingPrice,
    price_delta: priceDelta,
    upgrade_price: priceDelta,
  };
}

function pickStayRoom(rooms = [], stay = {}, meta = {}) {
  const list = Array.isArray(rooms) ? rooms : [];
  if (!list.length) return null;
  const roomId = stay.default_room_type_id || meta.roomTypeId || null;
  const roomName = String(stay.default_room_type_name || meta.tierName || '')
    .trim()
    .toLowerCase();
  const byId = roomId ? list.find((r) => String(r.id) === String(roomId)) : null;
  if (byId) return byId;
  if (roomName) {
    const exact = list.find((r) => String(r.name || '').trim().toLowerCase() === roomName);
    if (exact) return exact;
    const partial = list.find((r) => {
      const n = String(r.name || '').toLowerCase();
      return n.includes(roomName) || roomName.includes(n);
    });
    if (partial) return partial;
  }
  // Package base is usually Deluxe — prefer it over cheapest/first room (often Standard EP).
  const deluxe = list.find((r) => /\bdeluxe\b/i.test(String(r.name || '')));
  if (deluxe) return deluxe;
  return list[0] || null;
}

function pickStayMealPlan(room = null, mealKey = 'map') {
  const key = packageMealKey(mealKey, { hasHotel: true });
  const rateKey = String(key || 'map').toLowerCase();
  const fromRates = Number(room?.rates?.[rateKey] || 0) || 0;
  const epBase = Number(room?.epPrice || room?.rates?.ep || 0) || 0;
  const plans = Array.isArray(room?.mealPlanOptions) ? room.mealPlanOptions : [];
  const matched =
    plans.find((p) => String(p?.key || '').toLowerCase() === rateKey) ||
    plans.find((p) => new RegExp(`\\b${rateKey}\\b`, 'i').test(String(p?.label || ''))) ||
    null;
  if (matched) {
    const absolute =
      Number(matched.absolutePrice || 0) ||
      fromRates ||
      (epBase > 0 ? epBase + Number(matched.price || 0) : 0) ||
      0;
    return {
      key: String(matched.key || rateKey).toLowerCase(),
      label: matched.label || packageMealLabel(rateKey, { hasHotel: true }),
      price: Number(matched.price || 0),
      absolutePrice: absolute,
      meals: matched.meals || [],
    };
  }
  return {
    key: rateKey,
    label: packageMealLabel(rateKey, { hasHotel: true }),
    price: 0,
    absolutePrice: fromRates || 0,
    meals: rateKey === 'map' ? ['breakfast', 'dinner'] : rateKey === 'cp' ? ['breakfast'] : [],
  };
}

/**
 * Fill each itinerary night with package-selected hotel room + meal plan rates
 * from Uno Hotels detail API (https://api.unohotelsandresorts.com/docs).
 *
 * Day-options often ship stale hotel_slug values that 404 on /hotels/{city}/{slug}.
 * When that happens we resolve via hotel id / name search so absolute rates still load.
 */
async function hydrateItinerarySelectedStays(itinerary = [], stays = [], catalog = null, pricingQuery = {}) {
  const days = Array.isArray(itinerary) ? itinerary : [];
  if (!days.length) return days;

  const detailCache = new Map();
  const searchCache = new Map();
  const travelDate = normalizeYmd(pricingQuery.travelDate) || '';
  const rooms = Number(pricingQuery.rooms) || 1;
  const adults = Number(pricingQuery.adults) || 2;

  const loadDetail = async (city, slug, stayDates = {}) => {
    const key = [
      String(city || '').trim().toLowerCase(),
      String(slug || '').trim().toLowerCase(),
      stayDates.checkIn || '',
      stayDates.checkOut || '',
    ].join('||');
    if (!city || !slug) return null;
    if (detailCache.has(key)) return detailCache.get(key);
    try {
      const detail = await getUnoHotelDetail({
        city,
        slug,
        checkIn: stayDates.checkIn,
        checkOut: stayDates.checkOut,
        rooms,
        adults,
      });
      detailCache.set(key, detail);
      return detail;
    } catch {
      detailCache.set(key, null);
      return null;
    }
  };

  const searchHotel = async (city, name, hotelId) => {
    const cityKey = String(city || '').trim();
    const rawName = String(name || '').trim();
    if ((!cityKey && !rawName) || (!rawName && !hotelId)) return null;

    // Full package labels often include city ("emerald inn munnar") and return 0 hits —
    // try progressively shorter queries across city variants.
    const queries = [];
    if (rawName) {
      queries.push(rawName);
      const noComma = rawName.split(',')[0].trim();
      if (noComma && noComma !== rawName) queries.push(noComma);
      const words = noComma
        .split(/\s+/)
        .map((w) => w.trim())
        .filter((w) => w && !/^(hotel|the|resort|inn|by)$/i.test(w));
      if (words.length >= 2) queries.push(words.slice(0, 2).join(' '));
      if (words.length >= 1) queries.push(words[0]);
      // Keep a version with Hotel prefix stripped but meaningful tokens kept
      const stripped = noComma.replace(/^(hotel|the)\s+/i, '').trim();
      if (stripped && stripped !== noComma) queries.push(stripped);
    }

    const cities = [...new Set([cityKey, cityKey.split(',')[0].trim()].filter(Boolean))];
    // Some UNO hotels are filed under a sibling city label
    if (/leh/i.test(cityKey)) cities.push('Ladakh', 'Leh Ladakh');
    if (/ladakh/i.test(cityKey)) cities.push('Leh', 'Leh Ladakh');
    if (/munnar/i.test(cityKey)) cities.push('Munnar');
    if (/alleppey|alappuzha/i.test(cityKey)) cities.push('Alleppey', 'Alappuzha');

    const cacheKey = `${cityKey.toLowerCase()}||${String(hotelId || '').toLowerCase()}||${rawName.toLowerCase()}`;
    if (searchCache.has(cacheKey)) return searchCache.get(cacheKey);

    const needle = rawName.toLowerCase();
    const qList = [...new Set(queries.map((x) => String(x || '').trim()).filter((x) => x.length >= 2))];

    for (const tryCity of cities.length ? cities : ['']) {
      for (const q of qList) {
        try {
          const raw = await unoFetch('/v1/hotels/search', {
            query: {
              ...(tryCity ? { city: tryCity } : {}),
              q,
              limit: 10,
              sort: 'popular',
            },
          });
          const list = unwrapListPayload(raw) || [];
          if (!list.length) continue;

          const idHit =
            hotelId && list.find((h) => String(h.id) === String(hotelId));
          const exactHit =
            needle &&
            list.find((h) => {
              const hn = String(h.name || '').trim().toLowerCase();
              return hn === needle || hn === needle.split(',')[0].trim();
            });
          const softHit =
            needle &&
            list.find((h) => {
              const hn = String(h.name || '').toLowerCase();
              return (
                hn.includes(q.toLowerCase()) ||
                q.toLowerCase().includes(hn) ||
                needle.includes(hn) ||
                hn.includes(needle.slice(0, Math.min(10, needle.length)))
              );
            });
          const hit = idHit || exactHit || softHit || null;
          if (hit) {
            searchCache.set(cacheKey, hit);
            return hit;
          }
        } catch {
          /* try next */
        }
      }
    }

    searchCache.set(cacheKey, null);
    return null;
  };

  const resolveDetail = async ({ city, slug, hotelId, name, stayDates = {} }) => {
    let detail = await loadDetail(city, slug, stayDates);
    if (detail) return detail;

    // Prefer hotel-id endpoints when package slug is stale / 404
    if (hotelId) {
      for (const path of [`/v1/hotels/id/${hotelId}`, `/v1/hotels/${hotelId}`]) {
        try {
          const raw = await unoFetch(path);
          const hotel = unwrapPayload(raw);
          if (hotel?.city && hotel?.slug) {
            detail = await loadDetail(hotel.city, hotel.slug, stayDates);
            if (detail) return detail;
          }
          if (Array.isArray(hotel?.rooms) && hotel.rooms.length) {
            const withOverrides = await applyOpsRateOverridesToHotel(hotel, {
              checkIn: stayDates.checkIn,
            });
            return {
              ...mapHotelSummary(withOverrides),
              rooms: withOverrides.rooms.map(mapRoom),
            };
          }
        } catch {
          /* try next */
        }
      }
    }

    // Stale package hotel_slug → resolve live catalog slug via shortened name search
    const hit = await searchHotel(city, name, hotelId);
    if (hit?.city && hit?.slug) {
      detail = await loadDetail(hit.city, hit.slug, stayDates);
      if (detail) return detail;
    }

    return null;
  };

  const hydrated = [];
  for (const day of days) {
    const stay = findStayForDay(stays, day.day);
    const meta = day.hotelMeta || null;
    const hasHotel = Boolean(meta?.name || day.hotel);

    if (!hasHotel) {
      hydrated.push({
        ...day,
        meals: packageMealLabel('', { hasHotel: false }),
        mealPlanKey: 'ep',
      });
      continue;
    }

    if (!stay) {
      hydrated.push(day);
      continue;
    }

    const mealKey = packageMealKey(stay.default_meal_plan, { hasHotel: true });
    const info =
      stay.default_hotel_info && typeof stay.default_hotel_info === 'object'
        ? stay.default_hotel_info
        : {};
    const matchedOpt = (Array.isArray(stay.hotel_options) ? stay.hotel_options : []).find(
      (o) =>
        (meta?.hotelId && String(o.hotel_id) === String(meta.hotelId)) ||
        (meta?.id && String(o.hotel_id || o.id) === String(meta.id)) ||
        (meta?.name &&
          String(o.hotel_name || o.name || '')
            .trim()
            .toLowerCase() === String(meta.name).trim().toLowerCase())
    );
    const hotelId =
      meta?.hotelId ||
      meta?.id ||
      matchedOpt?.hotel_id ||
      stay.default_hotel_id ||
      null;
    const hotelName = meta?.name || day.hotel || stay.default_hotel_name || '';
    const catalogHotel =
      hotelId && catalog && typeof catalog.get === 'function'
        ? catalog.get(String(hotelId))
        : null;
    const city =
      catalogHotel?.city ||
      meta?.city ||
      matchedOpt?.city ||
      info.city ||
      stay.destination_city ||
      '';
    const slug =
      catalogHotel?.slug ||
      meta?.slug ||
      matchedOpt?.hotel_slug ||
      matchedOpt?.slug ||
      info.hotel_slug ||
      info.slug ||
      '';

    const stayDates = stayCheckInOut(stay, travelDate);
    const detail = await resolveDetail({
      city,
      slug,
      hotelId,
      name: hotelName,
      stayDates,
    });
    const resolvedCity = detail?.city || city;
    const resolvedSlug = detail?.slug || slug;

    const room = pickStayRoom(detail?.rooms || [], stay, meta || {});
    const mealPlan = pickStayMealPlan(room, mealKey);
    const rateKey = String(mealPlan.key || mealKey || 'map').toLowerCase();
    const absolute =
      Number(mealPlan.absolutePrice || 0) ||
      Number(room?.rates?.[rateKey] || 0) ||
      Number(meta?.absolutePerNight || 0) ||
      Number(meta?.startingPrice || matchedOpt?.starting_price || 0) ||
      0;
    const epRate =
      Number(room?.epPrice || room?.rates?.ep || room?.pricePerNight || 0) || 0;
    const mealKeyForBed = String(mealPlan.key || mealKey || 'map').toLowerCase();
    const extraBedPerNight = pickExtraBedNightRate(room?.extraBedRates, mealKeyForBed);

    hydrated.push({
      ...day,
      hotel: meta?.name || day.hotel || stay.default_hotel_name || '',
      accommodation: meta?.name || day.accommodation || stay.default_hotel_name || '',
      meals: mealPlan.label,
      mealPlanKey: mealPlan.key,
      hotelMeta: {
        ...(meta || {}),
        city: resolvedCity || meta?.city || '',
        slug: resolvedSlug || meta?.slug || '',
        tierName: room?.name || stay.default_room_type_name || meta?.tierName || '',
        roomTypeId: room?.id || stay.default_room_type_id || meta?.roomTypeId || null,
        meals: mealPlan.label,
        mealPlanKey: mealPlan.key,
        mealPlan,
        room: room
          ? {
              id: room.id,
              name: room.name,
              pricePerNight: absolute || Number(room.pricePerNight || 0),
              epPrice: epRate,
              rates: room.rates || null,
              extraBedRates: room.extraBedRates || null,
              mealPlanOptions: room.mealPlanOptions || [],
              bedType: room.bedType,
              maxOccupancy: room.maxOccupancy,
              extraBedRate: extraBedPerNight,
            }
          : {
              id: stay.default_room_type_id || null,
              name: stay.default_room_type_name || meta?.tierName || 'Deluxe',
            },
        absolutePerNight: absolute,
        includedRate: absolute,
        startingPrice: absolute,
        extraBedPerNight,
        selectedFromPackage: true,
      },
    });
  }

  return hydrated;
}

/** Hotels live on day-options `stays[]` — build default + alternatives for a night. */
function hotelOptionsFromStay(stay = {}, catalog = null) {
  if (!stay || typeof stay !== 'object') return [];
  const mealKey = packageMealKey(stay.default_meal_plan, { hasHotel: true });
  const meals = packageMealLabel(stay.default_meal_plan, { hasHotel: true });
  const location = stay.destination_city || stay.destination_state || '';
  const roomFallback = stay.default_room_type_name || '';
  const options = [];
  const defaultHotelId = stay.default_hotel_id || null;

  const defaultInfo =
    stay.default_hotel_info && typeof stay.default_hotel_info === 'object'
      ? stay.default_hotel_info
      : {};
  const defaultSlug = defaultInfo.hotel_slug || defaultInfo.slug || '';
  const defaultCity = defaultInfo.city || stay.destination_city || '';

  if (stay.default_hotel_name || defaultHotelId) {
    options.push(
      applyCatalogToOption(
        {
          id: defaultHotelId || stay.id || stay.default_hotel_name,
          hotel_id: defaultHotelId,
          hotel_name: stay.default_hotel_name,
          name: stay.default_hotel_name,
          room_type: stay.default_room_type_name || roomFallback,
          tier_name: stay.default_room_type_name || roomFallback,
          room_type_id: stay.default_room_type_id || null,
          meals,
          meal_plan: mealKey,
          mealPlanKey: mealKey,
          price_delta: Number(stay.default_upgrade_price || 0),
          is_default: true,
          location,
          city: defaultCity,
          slug: defaultSlug,
          hotel_slug: defaultSlug,
          image_url: defaultInfo.thumbnail_url || '',
          images: Array.isArray(defaultInfo.images) ? defaultInfo.images : [],
          star_rating: defaultInfo.star_category,
        },
        catalog,
        stay
      )
    );
  }

  for (const opt of Array.isArray(stay.hotel_options) ? stay.hotel_options : []) {
    if (defaultHotelId && opt.hotel_id && opt.hotel_id === defaultHotelId) continue;
    const name = pickHotelLabel(opt);
    if (!name && !opt.hotel_id) continue;
    const optSlug = opt.hotel_slug || opt.slug || '';
    options.push(
      applyCatalogToOption(
        {
          ...opt,
          name: name || opt.hotel_name,
          hotel_name: opt.hotel_name || name,
          room_type: opt.default_room_type_name || roomFallback,
          tier_name: opt.default_room_type_name || roomFallback,
          meals,
          meal_plan: mealKey,
          mealPlanKey: mealKey,
          price_delta: Number(opt.upgrade_price ?? opt.price_delta ?? 0),
          is_default: false,
          location,
          city: opt.city || stay.destination_city || '',
          slug: optSlug,
          hotel_slug: optSlug,
        },
        catalog,
        stay
      )
    );
  }

  return options;
}

function mapHotelMeta(option = {}) {
  if (!option || typeof option !== 'object') return null;
  const name = pickHotelLabel(option);
  if (!name) return null;
  const image = sanitizeImageUrl(
    option.image_url ||
      option.image ||
      option.featured_image ||
      option.thumbnail ||
      option.thumbnail_url ||
      option.cover_image ||
      (Array.isArray(option.images) ? option.images[0] : '')
  );
  const mealKey = packageMealKey(
    option.mealPlanKey || option.meal_plan || option.default_meal_plan || option.meals,
    { hasHotel: true }
  );
  const meals = packageMealLabel(mealKey, { hasHotel: true });
  const startingPrice = Number(
    option.starting_price ?? option.startingPrice ?? 0
  );
  // Upgrade delta only — package baseCost already includes the default hotel.
  const priceDelta = Number(option.price_delta ?? option.upgrade_price ?? 0) || 0;
  const slug = option.slug || option.hotel_slug || '';
  return {
    id: option.hotel_id || option.id || name,
    hotelId: option.hotel_id || option.id || null,
    name,
    image,
    images: sanitizeImages(option.images || (image ? [image] : [])),
    starRating: Number(
      option.star_rating || option.star_category || option.stars || option.rating || 0
    ),
    location: option.location || option.city || option.area || '',
    city: option.city || '',
    slug,
    meals,
    mealPlanKey: mealKey,
    startingPrice,
    priceDelta,
    tierName: option.tier_name || option.room_type || option.default_room_type_name || '',
    roomTypeId: option.room_type_id || option.default_room_type_id || null,
    isDefault: Boolean(option.is_default || option.isDefault || option.is_selected),
    amenities: Array.isArray(option.amenities) ? option.amenities : [],
  };
}

function mergeDayItinerary(itineraryDay = {}, optionDay = {}, stay = null, catalog = null) {
  const dayNumber = itineraryDay.day_number || optionDay.day_number;
  const dayHotelOptions = Array.isArray(optionDay.hotel_options) ? optionDay.hotel_options : [];
  const hotelOptionsRaw =
    dayHotelOptions.length > 0
      ? dayHotelOptions.map((opt) => applyCatalogToOption(opt, catalog, stay))
      : hotelOptionsFromStay(stay || {}, catalog);
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

  const hasHotel = Boolean(defaultHotelName);
  const mealPlanKey = packageMealKey(stay?.default_meal_plan, { hasHotel });
  const meals = packageMealLabel(stay?.default_meal_plan, { hasHotel });

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
    hotelMeta: defaultHotelMeta
      ? { ...defaultHotelMeta, meals, mealPlanKey }
      : defaultHotelMeta,
    hotelOptions,
    stayId: stay?.id || null,
    stayNights: stay ? Number(stay.nights) || 1 : null,
    activities: activities || sightseeing,
    sightseeing,
    meals,
    mealPlanKey,
    transport,
    dayImage: sanitizeImageUrl(itineraryDay.day_image || optionDay.day_image),
    dayImages: sanitizeImages(itineraryDay.day_images || optionDay.day_images || []),
  };
}

function dayKey(day = {}) {
  return Number(day.day_number ?? day.day) || null;
}

function stayNightNumbers(stays = []) {
  const nums = [];
  for (const stay of Array.isArray(stays) ? stays : []) {
    const cin = Number(stay.check_in_day);
    const cout = Number(stay.check_out_day);
    if (!Number.isFinite(cin) || !Number.isFinite(cout)) continue;
    for (let d = cin; d < cout; d += 1) nums.push(d);
  }
  return nums;
}

function enrichItineraryWithStays(itinerary = [], stays = [], catalog = null) {
  if (!Array.isArray(itinerary) || !itinerary.length) return [];
  if (!Array.isArray(stays) || !stays.length) return itinerary;

  return itinerary.map((day) => {
    const dayNum = dayKey(day);
    const stay = findStayForDay(stays, dayNum);
    const hasHotelEarly = Boolean(day.hotelMeta?.name || day.hotel);
    if (!stay) {
      if (!hasHotelEarly) {
        return {
          ...day,
          meals: packageMealLabel('', { hasHotel: false }),
          mealPlanKey: 'ep',
        };
      }
      return day;
    }

    const hotelOptions = hotelOptionsFromStay(stay, catalog).map(mapHotelMeta).filter(Boolean);
    const defaultHotel = hotelOptions.find((o) => o.isDefault) || hotelOptions[0] || null;
    const existingHasImage = Boolean(day.hotelMeta?.image || day.hotelMeta?.images?.length);
    const nextHasImage = Boolean(defaultHotel?.image || defaultHotel?.images?.length);
    const hasHotel = Boolean(day.hotelMeta?.name || day.hotel);
    const hasOptions = Array.isArray(day.hotelOptions) && day.hotelOptions.length > 0;

    // Prefer catalog-hydrated options when existing cards lack images
    if (hasHotel && hasOptions && existingHasImage && (!catalog || !nextHasImage)) {
      return {
        ...day,
        stayId: day.stayId || stay.id || null,
        stayNights: day.stayNights || Number(stay.nights) || 1,
      };
    }

    if (!defaultHotel && !hasHotel) {
      return {
        ...day,
        stayId: day.stayId || stay.id || null,
        stayNights: day.stayNights || Number(stay.nights) || 1,
      };
    }

    const hotelName = defaultHotel?.name || day.hotelMeta?.name || day.hotel || '';
    const mealKey = packageMealKey(stay.default_meal_plan, { hasHotel: Boolean(hotelName) });
    const meals = packageMealLabel(stay.default_meal_plan, { hasHotel: Boolean(hotelName) });
    return {
      ...day,
      hotel: hotelName,
      accommodation: hotelName || day.accommodation || '',
      hotelMeta: defaultHotel
        ? { ...defaultHotel, meals, mealPlanKey: mealKey }
        : day.hotelMeta,
      hotelOptions: hotelOptions.length ? hotelOptions : day.hotelOptions || [],
      meals,
      mealPlanKey: mealKey,
      stayId: day.stayId || stay.id || null,
      stayNights: day.stayNights || Number(stay.nights) || 1,
    };
  });
}

function buildMergedItinerary(itineraryDays = [], optionDays = [], stays = [], catalog = null) {
  const itineraryByDay = new Map(
    (Array.isArray(itineraryDays) ? itineraryDays : [])
      .map((day) => [dayKey(day), day])
      .filter(([key]) => key)
  );
  const optionByDay = new Map(
    (Array.isArray(optionDays) ? optionDays : [])
      .map((day) => [dayKey(day), day])
      .filter(([key]) => key)
  );
  const dayNumbers = [
    ...new Set([
      ...itineraryByDay.keys(),
      ...optionByDay.keys(),
      ...stayNightNumbers(stays),
    ]),
  ]
    .filter(Boolean)
    .sort((a, b) => a - b);

  if (!dayNumbers.length) return [];

  const stayList = Array.isArray(stays) ? stays : [];

  return dayNumbers.map((dayNumber) =>
    mergeDayItinerary(
      itineraryByDay.get(dayNumber) || {},
      optionByDay.get(dayNumber) || { day_number: dayNumber },
      findStayForDay(stayList, dayNumber),
      catalog
    )
  );
}

function mapDayOptionsToItinerary(days = [], stays = [], catalog = null) {
  return buildMergedItinerary([], days, stays, catalog);
}

async function fetchUnoPackageDayOptionsPayload(slug, pricing = {}) {
  const travelDate = normalizeYmd(pricing.travelDate) || todayYmd();
  const payload = await unoFetch(`/v1/packages/${encodeURIComponent(slug)}/day-options`, {
    query: {
      travel_date: travelDate,
      adults: Number(pricing.adults) || 2,
      rooms: Number(pricing.rooms) || 1,
    },
  });
  return unwrapPayload(payload);
}

function mapPackageCab(cab = {}, { defaultAbsolute = 0 } = {}) {
  const absolute = Number(cab.price_delta || cab.absoluteFare || 0) || 0;
  const explicitUpgrade = cab.upgrade_price ?? cab.upgradePrice;
  const upgrade =
    explicitUpgrade != null && explicitUpgrade !== ''
      ? Number(explicitUpgrade) || 0
      : defaultAbsolute > 0
        ? Math.max(0, absolute - defaultAbsolute)
        : 0;

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
    absoluteFare: absolute,
    cost: upgrade,
    totalAmount: absolute,
    priceDelta: upgrade,
    upgradePrice: upgrade,
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

async function attachItineraryFromDayOptions(mapped, slug, itineraryDaysFromPackage = [], pricingQuery = {}) {
  if (!slug) return mapped;

  const packageItineraryDays = Array.isArray(itineraryDaysFromPackage) ? itineraryDaysFromPackage : [];

  try {
    const payload = await fetchUnoPackageDayOptionsPayload(slug, pricingQuery);
    mapped._apiRaw = { ...(mapped._apiRaw || {}), dayOptions: payload };
    const days = Array.isArray(payload?.days) ? payload.days : [];
    const stays = Array.isArray(payload?.stays) ? payload.stays : [];
    const rawCabs = (Array.isArray(payload?.cabs) ? payload.cabs : []).filter(
      (cab) => cab.is_active !== false
    );
    const defaultRaw = rawCabs.find((c) => c.is_default) || rawCabs[0] || null;
    const defaultAbsolute = Number(defaultRaw?.price_delta || 0) || 0;
    const packageCabs = rawCabs
      .map((cab) => mapPackageCab(cab, { defaultAbsolute }))
      .sort((a, b) => {
        if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
        const aBus = /volvo|\bbus\b/i.test(String(a.name || '')) ? 0 : 1;
        const bBus = /volvo|\bbus\b/i.test(String(b.name || '')) ? 0 : 1;
        if (aBus !== bBus) return aBus - bBus;
        return (a.absoluteFare || 0) - (b.absoluteFare || 0);
      });

    if (packageCabs.length) mapped.packageCabs = packageCabs;

    if (days.length > 0 || packageItineraryDays.length > 0 || stays.length > 0) {
      const catalog = await resolveHotelCatalog(stays);
      const merged = enrichItineraryWithStays(
        buildMergedItinerary(packageItineraryDays, days, stays, catalog),
        stays,
        catalog
      );
      mapped.itinerary = await hydrateItinerarySelectedStays(merged, stays, catalog, pricingQuery);
      mapped.hotelCatalogSize = catalog.size;
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
    pricePer: pkg.price_per || pkg.pricePer || 'per_couple',
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
  const dest = String(query.destination || '').trim();
  const destHint = dest
    ? String(preferredDestinationSearch(dest) || dest).trim().toLowerCase()
    : '';
  const typedSearch = String(query.search || '').trim().toLowerCase();
  const normalized = {
    page: Number(query.page) || 1,
    limit: Math.min(Number(query.limit) || UNO_API_MAX_LIMIT, UNO_API_MAX_LIMIT),
    search: destHint || typedSearch,
    destination: destHint || dest.toLowerCase(),
    status: query.status || 'published',
    tour_type: query.tour_type || '',
    destination_id: query.destination_id || '',
  };
  return `uno:packages:list:${JSON.stringify(normalized)}`;
}

async function fetchUnoPackages(query = {}) {
  const limit = Math.min(Number(query.limit) || UNO_API_MAX_LIMIT, UNO_API_MAX_LIMIT);
  const destHint = String(preferredDestinationSearch(query.destination) || '').trim().toLowerCase();
  const typedSearch = String(query.search || '').trim().toLowerCase();
  // With a destination, always search UNO by destination family — never replace with a name keyword
  const search = destHint || typedSearch;
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

  let items = (unwrapped.items || []).map((pkg) => mapUnoPackage(pkg));
  if (query.destination) {
    items = items.filter((pkg) => matchesDestination(pkg, query.destination));
  }
  // Optional explicit name filter (query.nameSearch), or typed search when no destination
  const nameFilter = String(query.nameSearch || (!destHint ? typedSearch : '') || '')
    .trim()
    .toLowerCase();
  if (nameFilter) {
    const tokens = nameFilter.split(/\s+/).filter(Boolean);
    items = items.filter((pkg) => {
      const hay = [
        pkg.name,
        pkg.destination,
        pkg.destinationName,
        pkg.state,
        pkg.shortDescription,
        pkg.packageCode,
        pkg.slug,
      ]
        .map((x) => String(x || '').toLowerCase())
        .join(' ');
      return tokens.every((t) => hay.includes(t));
    });
  }

  const filtered = items;
  // Keep UNO pagination metadata so clients can fetch more destination pages.
  // Filtered length is only for the current page slice.
  const unoTotal = Number(unwrapped.total ?? filtered.length);
  const unoTotalPages = Number(
    unwrapped.total_pages ?? Math.max(1, Math.ceil(unoTotal / limit))
  );
  const total = nameFilter ? filtered.length : unoTotal;
  const totalPages = nameFilter ? 1 : unoTotalPages;

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

async function fetchUnoPackageById(packageId, pricingQuery = {}) {
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
    rawPackageApi?.itinerary_days || [],
    pricingQuery
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

async function getUnoPackageById(packageId, query = {}) {
  const travelDate = normalizeYmd(query.travelDate || query.travel_date) || todayYmd();
  const adults = Math.max(1, Number(query.adults) || 2);
  const rooms = Math.max(1, Number(query.rooms) || 1);
  const pricingQuery = { travelDate, adults, rooms };
  return cacheService.getOrSet(
    `uno:packages:detail:v8:${packageId}:${travelDate}:${adults}:${rooms}`,
    () => fetchUnoPackageById(packageId, pricingQuery),
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
