/** Dev helper — logs full selected package data in browser console. */
export function logSelectedPackageDebug(pkg, meta = {}) {
  if (typeof window === 'undefined' || !pkg) return;

  const name = pkg.name || pkg.slug || pkg._id || 'Unknown package';
  console.group(`📦 Selected Package — ${name}`);

  console.log('Selection meta:', meta);
  console.log('Mapped package (quotation me use hoga):', pkg);

  console.table({
    id: pkg.id || pkg._id,
    slug: pkg.slug,
    name: pkg.name,
    destination: pkg.destination,
    duration: pkg.durationLabel || `${pkg.duration}D / ${pkg.durationNights}N`,
    startingPrice: pkg.startingPrice,
    itineraryDays: pkg.itinerary?.length || 0,
    packageCabs: pkg.packageCabs?.length || 0,
    inclusions: pkg.inclusions?.length || 0,
    exclusions: pkg.exclusions?.length || 0,
    galleryImages: pkg.galleryImages?.length || 0,
  });

  if (pkg.packageCabs?.length) {
    console.group('Package Cabs (mapped)');
    console.table(
      pkg.packageCabs.map((cab) => ({
        id: cab.id,
        name: cab.name,
        seats: cab.seatingCapacity,
        price: cab.cost ?? cab.priceDelta,
        isDefault: cab.isDefault,
        isPopular: cab.isPopular,
      }))
    );
    console.log(pkg.packageCabs);
    console.groupEnd();
  }

  if (pkg.itinerary?.length) {
    console.group('Itinerary (mapped)');
    console.table(
      pkg.itinerary.map((day) => ({
        day: day.day,
        title: day.title,
        hotel: day.hotel,
        activities: day.activities,
        meals: day.meals,
      }))
    );
    console.log(pkg.itinerary);
    console.groupEnd();
  }

  if (pkg.inclusions?.length) {
    console.group('Inclusions');
    console.log(pkg.inclusions);
    console.groupEnd();
  }

  if (pkg.exclusions?.length) {
    console.group('Exclusions');
    console.log(pkg.exclusions);
    console.groupEnd();
  }

  if (pkg._apiRaw?.package) {
    console.group('🔗 Raw UNO API — GET /v1/packages/{slug}');
    console.log(pkg._apiRaw.package);
    console.groupEnd();
  }

  if (pkg._apiRaw?.dayOptions) {
    const dayOptions = pkg._apiRaw.dayOptions;
    console.group('🔗 Raw UNO API — GET /v1/packages/{slug}/day-options');
    console.log('Top-level keys:', Object.keys(dayOptions || {}));

    if (Array.isArray(dayOptions?.cabs) && dayOptions.cabs.length) {
      console.group(`cabs[] (${dayOptions.cabs.length})`);
      console.table(dayOptions.cabs);
      console.log(dayOptions.cabs);
      console.groupEnd();
    }

    if (Array.isArray(dayOptions?.days) && dayOptions.days.length) {
      console.group(`days[] (${dayOptions.days.length})`);
      console.table(
        dayOptions.days.map((day) => ({
          day: day.day_number,
          title: day.title,
          location: day.location,
          hotelOptions: day.hotel_options?.length || 0,
          sightseeing: day.sightseeing?.length || 0,
          activities: day.activities?.length || 0,
        }))
      );
      console.log(dayOptions.days);
      console.groupEnd();
    }

    if (Array.isArray(dayOptions?.stays) && dayOptions.stays.length) {
      console.group(`stays[] (${dayOptions.stays.length})`);
      console.table(
        dayOptions.stays.map((stay) => ({
          city: stay.destination_city,
          cin: stay.check_in_day,
          cout: stay.check_out_day,
          nights: stay.nights,
          hotel: stay.default_hotel_name,
          room: stay.default_room_type_name,
          meal: stay.default_meal_plan,
          options: Array.isArray(stay.hotel_options) ? stay.hotel_options.length : 0,
        }))
      );
      console.log(dayOptions.stays);
      console.groupEnd();
    }

    console.log('Full day-options payload:', dayOptions);
    console.groupEnd();
  }

  console.log('All mapped keys:', Object.keys(pkg));
  console.groupEnd();
}
