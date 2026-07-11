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

function mergeDayItinerary(itineraryDay = {}, optionDay = {}) {
  const dayNumber = itineraryDay.day_number || optionDay.day_number;
  const hotelOptions = Array.isArray(optionDay.hotel_options) ? optionDay.hotel_options : [];
  const defaultHotelOption = pickDefaultHotelOption(hotelOptions);
  const defaultHotelName = pickHotelLabel(defaultHotelOption) || itineraryDay.hotel_name || '';

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
    formatMealsLabel(defaultHotelOption?.meals)
    || (Array.isArray(itineraryDay.meals_selected) ? itineraryDay.meals_selected.join(', ') : '')
    || itineraryDay.dinner
    || '';

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
  const mappedItinerary = Array.isArray(source.itinerary) ? source.itinerary : [];
  const hasRichMappedItinerary = mappedItinerary.some(
    (day) => day.description?.trim() || day.hotel?.trim() || day.activities?.trim()
  );
  if (hasRichMappedItinerary) return mappedItinerary;

  const itineraryDays = source._apiRaw?.package?.itinerary_days || source.itinerary_days || [];
  const optionDays = source._apiRaw?.dayOptions?.days || [];
  const merged = buildMergedItinerary(itineraryDays, optionDays);
  if (merged.length) return merged;

  return mappedItinerary;
}
