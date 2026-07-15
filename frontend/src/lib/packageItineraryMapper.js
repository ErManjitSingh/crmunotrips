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

function pickHotelLabel(option = {}) {
  return option.name || option.hotel_name || option.title || option.hotelName || option.tier_name || '';
}

function pickDefaultHotelOption(options = []) {
  return options.find((option) => option.is_default || option.isDefault || option.is_selected) || options[0] || null;
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

/** Normalize a UNO day-options hotel_option into itinerary hotelMeta. */
export function mapHotelOption(option = {}) {
  if (!option || typeof option !== 'object') return null;
  const name = pickHotelLabel(option);
  if (!name) return null;
  return {
    id: option.id || option.hotel_id || option.hotelId || name,
    name,
    image: pickImage(option),
    images: Array.isArray(option.images) ? option.images.filter(Boolean) : [],
    starRating: Number(option.star_rating || option.stars || option.rating || option.starCategory || 0),
    location: option.location || option.city || option.area || '',
    meals: formatMealsLabel(option.meals),
    mealsRaw: option.meals || null,
    priceDelta: Number(option.price_delta ?? option.priceDelta ?? option.price ?? 0),
    tierName: option.tier_name || option.room_type || option.roomType || '',
    isDefault: Boolean(option.is_default || option.isDefault || option.is_selected),
    raw: option,
  };
}

function mergeDayItinerary(itineraryDay = {}, optionDay = {}) {
  const dayNumber = itineraryDay.day_number || optionDay.day_number;
  const hotelOptionsRaw = Array.isArray(optionDay.hotel_options) ? optionDay.hotel_options : [];
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

  const meals =
    defaultHotelOption?.meals ||
    formatMealsLabel(hotelOptionsRaw.find((o) => o.is_default || o.isDefault)?.meals) ||
    (Array.isArray(itineraryDay.meals_selected) ? itineraryDay.meals_selected.join(', ') : '') ||
    itineraryDay.dinner ||
    itineraryDay.meals ||
    '';

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
    hotelMeta: defaultHotelOption,
    hotelOptions,
    activities: activities || sightseeing,
    sightseeing,
    meals,
    transport,
    dayImage: itineraryDay.day_image || optionDay.day_image || '',
    dayImages: Array.isArray(itineraryDay.day_images || optionDay.day_images)
      ? itineraryDay.day_images || optionDay.day_images
      : [],
  };
}

export function buildMergedItinerary(itineraryDays = [], optionDays = []) {
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

/** Prefer merged package itinerary from API raw payloads when mapped itinerary is sparse. */
export function resolvePackageItinerary(source = {}) {
  const itineraryDays = source._apiRaw?.package?.itinerary_days || source.itinerary_days || [];
  const optionDays = source._apiRaw?.dayOptions?.days || [];

  // Always prefer day-options merge when available (rich hotel cards)
  if (optionDays.length || itineraryDays.length) {
    const merged = buildMergedItinerary(itineraryDays, optionDays);
    if (merged.length) return merged;
  }

  const mappedItinerary = Array.isArray(source.itinerary) ? source.itinerary : [];
  return mappedItinerary;
}

/** Seed DayWiseHotelSelector / snapshot shape from itinerary hotelMeta. */
export function seedDayWiseHotelsFromItinerary(itinerary = []) {
  return (Array.isArray(itinerary) ? itinerary : [])
    .filter((day) => day?.hotelMeta?.name || day?.hotel)
    .map((day) => {
      const meta = day.hotelMeta || { name: day.hotel };
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
        },
        room: { name: meta.tierName || 'Standard Room' },
        mealPlan: { label: meta.meals || day.meals || 'As per package' },
        perNight: Number(meta.priceDelta || 0),
        totalCost: Number(meta.priceDelta || 0),
        nights: 1,
        fromPackage: true,
        hotelOptions: day.hotelOptions || [],
      };
    })
    .sort((a, b) => a.day - b.day);
}
