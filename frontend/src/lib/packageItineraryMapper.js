import {
  DEFAULT_MAP_MEAL_PLAN,
  mealPlanFromCode,
  normalizeMealPlanKey,
} from './mealPlanDefaults';

function formatMealsLabel(meals = {}) {
  if (typeof meals === 'string') return meals.trim();
  const selected = [];
  if (meals.breakfast) selected.push('Breakfast');
  if (meals.lunch) selected.push('Lunch');
  if (meals.dinner) selected.push('Dinner');
  return selected.join(', ');
}

/** UNO stay meal codes → display label. */
function formatMealPlanCode(code = '') {
  const key = normalizeMealPlanKey(code) || String(code || '').trim().toLowerCase();
  const map = {
    ep: 'EP (Room only)',
    cp: 'CP (Breakfast)',
    map: 'MAP (Breakfast + Dinner)',
    ap: 'AP (All meals)',
    ai: 'AI (All inclusive)',
  };
  return map[key] || (code ? String(code).toUpperCase() : '');
}

/**
 * Package API meal plan: use stay.default_meal_plan (usually MAP).
 * Departure / no-hotel days → EP.
 */
function packageMealLabel(code = '', { hasHotel = true } = {}) {
  if (!hasHotel) return formatMealPlanCode('ep');
  const key = normalizeMealPlanKey(code) || 'map';
  return formatMealPlanCode(key) || DEFAULT_MAP_MEAL_PLAN.label;
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

function pickHotelLabel(option = {}) {
  return option.name || option.hotel_name || option.title || option.hotelName || option.tier_name || '';
}

function pickImage(option = {}) {
  return (
    option.image_url ||
    option.image ||
    option.featured_image ||
    option.featuredImage ||
    option.thumbnail ||
    option.cover_image ||
    (Array.isArray(option.images) ? option.images[0] : '') ||
    ''
  );
}

/** Stay covers overnight for check_in_day … check_out_day - 1. */
export function stayCoversDay(stay = {}, dayNumber) {
  const cin = Number(stay.check_in_day);
  const cout = Number(stay.check_out_day);
  const day = Number(dayNumber);
  if (!Number.isFinite(cin) || !Number.isFinite(cout) || !Number.isFinite(day)) return false;
  return day >= cin && day < cout;
}

export function findStayForDay(stays = [], dayNumber) {
  const list = Array.isArray(stays) ? stays.filter((s) => s?.is_active !== false) : [];
  return list.find((stay) => stayCoversDay(stay, dayNumber)) || null;
}

/**
 * UNO day-options put hotels on top-level `stays[]`, not on each day.
 * Build hotel_options[] (default first) for a stay night.
 */
export function hotelOptionsFromStay(stay = {}) {
  if (!stay || typeof stay !== 'object') return [];
  const mealKey = packageMealKey(stay.default_meal_plan, { hasHotel: true });
  const meals = packageMealLabel(stay.default_meal_plan, { hasHotel: true });
  const location = stay.destination_city || stay.destination_state || '';
  const roomFallback = stay.default_room_type_name || '';
  const options = [];
  const defaultHotelId = stay.default_hotel_id || null;

  if (stay.default_hotel_name || defaultHotelId) {
    options.push({
      id: defaultHotelId || stay.id || stay.default_hotel_name,
      hotel_id: defaultHotelId,
      hotel_name: stay.default_hotel_name,
      name: stay.default_hotel_name,
      room_type: stay.default_room_type_name || roomFallback,
      tier_name: stay.default_room_type_name || roomFallback,
      meals,
      meal_plan: mealKey,
      mealPlanKey: mealKey,
      price_delta: Number(stay.default_upgrade_price || 0),
      is_default: true,
      location,
    });
  }

  for (const opt of Array.isArray(stay.hotel_options) ? stay.hotel_options : []) {
    if (defaultHotelId && opt.hotel_id && opt.hotel_id === defaultHotelId) continue;
    const name = pickHotelLabel(opt);
    if (!name) continue;
    options.push({
      ...opt,
      name,
      hotel_name: opt.hotel_name || name,
      room_type: opt.default_room_type_name || roomFallback,
      tier_name: opt.default_room_type_name || roomFallback,
      meals,
      meal_plan: mealKey,
      mealPlanKey: mealKey,
      price_delta: Number(opt.upgrade_price ?? opt.price_delta ?? 0),
      is_default: false,
      location,
    });
  }

  return options;
}

/** Normalize a UNO hotel option / stay option into itinerary hotelMeta. */
export function mapHotelOption(option = {}) {
  if (!option || typeof option !== 'object') return null;
  const name = pickHotelLabel(option);
  if (!name) return null;
  const mealKey = packageMealKey(
    option.mealPlanKey || option.meal_plan || option.default_meal_plan || option.meals,
    { hasHotel: true }
  );
  const meals = packageMealLabel(
    option.mealPlanKey || option.meal_plan || option.default_meal_plan || option.meals,
    { hasHotel: true }
  );
  const startingPrice = Number(option.starting_price ?? option.startingPrice ?? 0);
  // True upgrade only — do not fall back to catalog starting_price (double-counts package base).
  const priceDelta = Number(
    option.price_delta ?? option.priceDelta ?? option.upgrade_price ?? 0
  ) || 0;
  return {
    id: option.id || option.hotel_id || option.hotelId || name,
    name,
    image: pickImage(option),
    images: Array.isArray(option.images) ? option.images.filter(Boolean) : [],
    starRating: Number(option.star_rating || option.stars || option.rating || option.starCategory || 0),
    location: option.location || option.city || option.area || '',
    meals,
    mealPlanKey: mealKey,
    mealsRaw: option.meals || null,
    startingPrice,
    absolutePerNight: startingPrice,
    includedRate: startingPrice,
    priceDelta,
    tierName:
      option.tier_name ||
      option.room_type ||
      option.roomType ||
      option.default_room_type_name ||
      '',
    isDefault: Boolean(option.is_default || option.isDefault || option.is_selected),
    raw: option,
  };
}

function mergeDayItinerary(itineraryDay = {}, optionDay = {}, stay = null) {
  const dayNumber = itineraryDay.day_number || optionDay.day_number;
  const dayHotelOptions = Array.isArray(optionDay.hotel_options) ? optionDay.hotel_options : [];
  const hotelOptionsRaw =
    dayHotelOptions.length > 0 ? dayHotelOptions : hotelOptionsFromStay(stay || {});
  const hotelOptions = hotelOptionsRaw.map(mapHotelOption).filter(Boolean);
  const defaultHotelOption =
    hotelOptions.find((o) => o.isDefault) || hotelOptions[0] || null;
  const defaultHotelName =
    defaultHotelOption?.name || itineraryDay.hotel_name || itineraryDay.hotel || '';

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

  const meals = packageMealLabel(stay?.default_meal_plan, {
    hasHotel: Boolean(defaultHotelName),
  });
  const mealPlanKey = packageMealKey(stay?.default_meal_plan, {
    hasHotel: Boolean(defaultHotelName),
  });

  const transport = itineraryDay.transport || itineraryDay.cab_name || itineraryDay.transport_mode || '';

  return {
    id: itineraryDay.id || optionDay.id || `day-${dayNumber}`,
    day: dayNumber,
    title: String(itineraryDay.title || optionDay.title || `Day ${dayNumber}`).trim(),
    description: String(
      itineraryDay.description || optionDay.description || optionDay.location || ''
    ).trim(),
    hotel: defaultHotelName,
    accommodation: defaultHotelName,
    hotelMeta: defaultHotelOption
      ? { ...defaultHotelOption, mealPlanKey, meals }
      : defaultHotelOption,
    hotelOptions,
    stayId: stay?.id || null,
    stayNights: stay ? Number(stay.nights) || 1 : null,
    activities: activities || sightseeing,
    sightseeing,
    meals,
    mealPlanKey,
    transport,
    dayImage: itineraryDay.day_image || optionDay.day_image || '',
    dayImages: Array.isArray(itineraryDay.day_images || optionDay.day_images)
      ? itineraryDay.day_images || optionDay.day_images
      : [],
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

/** Fill missing hotel / options on an existing itinerary from day-options stays[]. */
export function enrichItineraryWithStays(itinerary = [], stays = []) {
  if (!Array.isArray(itinerary) || !itinerary.length) return [];
  if (!Array.isArray(stays) || !stays.length) return itinerary;

  return itinerary.map((day) => {
    const dayNum = dayKey(day);
    const stay = findStayForDay(stays, dayNum);
    const hasHotel = Boolean(day.hotelMeta?.name || day.hotel);

    if (!stay) {
      // Departure / non-stay day → EP (no overnight hotel meal plan).
      if (!hasHotel) {
        return {
          ...day,
          meals: packageMealLabel('', { hasHotel: false }),
          mealPlanKey: 'ep',
        };
      }
      return day;
    }

    const hasOptions = Array.isArray(day.hotelOptions) && day.hotelOptions.length > 0;
    if (hasHotel && hasOptions) {
      const mealKey = packageMealKey(stay.default_meal_plan, { hasHotel: true });
      return {
        ...day,
        meals: day.meals || packageMealLabel(stay.default_meal_plan, { hasHotel: true }),
        mealPlanKey: day.mealPlanKey || mealKey,
        stayId: day.stayId || stay.id || null,
        stayNights: day.stayNights || Number(stay.nights) || 1,
      };
    }

    const hotelOptions = hotelOptionsFromStay(stay).map(mapHotelOption).filter(Boolean);
    const defaultHotel = hotelOptions.find((o) => o.isDefault) || hotelOptions[0] || null;
    const hotelName = hasHotel
      ? day.hotelMeta?.name || day.hotel
      : defaultHotel?.name || '';
    const mealKey = packageMealKey(stay.default_meal_plan, { hasHotel: Boolean(hotelName) });
    const meals = packageMealLabel(stay.default_meal_plan, { hasHotel: Boolean(hotelName) });

    return {
      ...day,
      hotel: hotelName,
      accommodation: hotelName || day.accommodation || '',
      hotelMeta: day.hotelMeta?.name
        ? { ...day.hotelMeta, mealPlanKey: day.hotelMeta.mealPlanKey || mealKey, meals: day.hotelMeta.meals || meals }
        : defaultHotel
          ? { ...defaultHotel, mealPlanKey: mealKey, meals }
          : day.hotelMeta,
      hotelOptions: hasOptions ? day.hotelOptions : hotelOptions,
      meals,
      mealPlanKey: mealKey,
      stayId: day.stayId || stay.id || null,
      stayNights: day.stayNights || Number(stay.nights) || 1,
    };
  });
}

export function buildMergedItinerary(itineraryDays = [], optionDays = [], stays = []) {
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
      findStayForDay(stayList, dayNumber)
    )
  );
}

function itineraryHotelRichness(days = []) {
  return (Array.isArray(days) ? days : []).reduce((score, day) => {
    if (day?.hotelMeta?.image || day?.hotelMeta?.images?.length) score += 4;
    if (day?.hotelMeta?.starRating) score += 1;
    if (day?.hotelMeta?.name || day?.hotel) score += 1;
    if (Array.isArray(day?.hotelOptions) && day.hotelOptions.length) score += 1;
    if (day?.hotelOptions?.some((o) => o.image || o.images?.length)) score += 2;
    return score;
  }, 0);
}

/** Prefer merged package itinerary from API raw payloads when mapped itinerary is sparse. */
export function resolvePackageItinerary(source = {}) {
  const itineraryDays = source._apiRaw?.package?.itinerary_days || source.itinerary_days || [];
  const optionDays = source._apiRaw?.dayOptions?.days || [];
  const stays = source._apiRaw?.dayOptions?.stays || source.stays || [];
  const existing = Array.isArray(source.itinerary) ? source.itinerary : [];

  // Backend already hydrates hotel_ids via Uno Hotels search — keep that payload.
  if (existing.length && itineraryHotelRichness(existing) > 0) {
    const existingScore = itineraryHotelRichness(existing);
    let merged = [];
    if (optionDays.length || itineraryDays.length || stays.length) {
      merged = buildMergedItinerary(itineraryDays, optionDays, stays);
    }
    if (existingScore >= itineraryHotelRichness(merged)) {
      return enrichItineraryWithStays(existing, stays);
    }
  }

  let merged = [];
  if (optionDays.length || itineraryDays.length || stays.length) {
    merged = buildMergedItinerary(itineraryDays, optionDays, stays);
  }

  const mergedHasHotels = merged.some((d) => d.hotelMeta?.name || d.hotel);
  const existingHasHotels = existing.some((d) => d.hotelMeta?.name || d.hotel);

  if (!merged.length) {
    return enrichItineraryWithStays(existing, stays);
  }
  if (existing.length && existingHasHotels && !mergedHasHotels) {
    return enrichItineraryWithStays(existing, stays);
  }
  if (existing.length > merged.length && !mergedHasHotels) {
    return enrichItineraryWithStays(existing, stays);
  }

  return enrichItineraryWithStays(merged, stays);
}

/** Seed DayWiseHotelSelector / snapshot shape from itinerary hotelMeta. */
/** Seed DayWiseHotelSelector / snapshot shape from itinerary hotelMeta. */
export function seedDayWiseHotelsFromItinerary(itinerary = []) {
  return (Array.isArray(itinerary) ? itinerary : [])
    .filter((day) => day?.hotelMeta?.name || day?.hotel)
    .map((day) => {
      const meta = day.hotelMeta || { name: day.hotel };
      const meal = mealPlanFromCode(
        meta.mealPlanKey || meta.meals || day.mealPlanKey || day.meals,
        'map'
      );
      return {
        day: day.day,
        hotel: {
          id: meta.id,
          name: meta.name || day.hotel,
          image: meta.image || '',
          images: meta.images || [],
          starCategory: meta.starRating || 0,
          starRating: meta.starRating || 0,
          location: meta.location || '',
          startingPrice: meta.startingPrice || 0,
        },
        room: { name: meta.tierName || 'Standard Room' },
        mealPlan: {
          key: meal.key,
          label: meal.label,
        },
        meals: meal.label,
        // Package baseCost already includes default hotels — only upgrade deltas add cost.
        perNight: Number(meta.priceDelta || 0),
        totalCost: Number(meta.priceDelta || 0),
        absolutePerNight: Number(meta.startingPrice || 0),
        includedRate: Number(meta.startingPrice || 0),
        nights: 1,
        fromPackage: true,
        hotelOptions: day.hotelOptions || [],
      };
    })
    .sort((a, b) => a.day - b.day);
}
