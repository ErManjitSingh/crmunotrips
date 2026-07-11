function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

/** Map raw cab from UNO day-options `cabs[]` to quotation transport shape. */
export function mapPackageCabFromRaw(cab = {}) {
  if (cab.isPackageCab || cab.externalSource === 'uno_package') return cab;

  return {
    id: cab.id,
    packageCabId: cab.id,
    cabTypeId: cab.cab_type_id || cab.cabTypeId || null,
    name: cab.name || 'Cab',
    vehicleType: cab.name || 'Cab',
    cabCategory: cab.name || '',
    seatingCapacity: cab.seats ?? cab.seatingCapacity,
    description: cab.description || '',
    featuredImage: cab.image_url || cab.featuredImage || '',
    cost: toNumber(cab.price_delta ?? cab.cost ?? cab.priceDelta, 0),
    totalAmount: toNumber(cab.price_delta ?? cab.totalAmount ?? cab.priceDelta, 0),
    priceDelta: toNumber(cab.price_delta ?? cab.priceDelta, 0),
    isDefault: Boolean(cab.is_default ?? cab.isDefault),
    isPopular: Boolean(cab.is_popular ?? cab.isPopular),
    isActive: (cab.is_active ?? cab.isActive) !== false,
    sortOrder: toNumber(cab.sort_order ?? cab.sortOrder, 0),
    externalSource: 'uno_package',
    isPackageCab: true,
    tripType: 'full_day',
  };
}

export function resolvePackageCabs(source = {}) {
  const mapped = Array.isArray(source.packageCabs)
    ? source.packageCabs
    : Array.isArray(source.package_cabs)
      ? source.package_cabs
      : [];

  const rawFromApi = source._apiRaw?.dayOptions?.cabs;
  const rawCabs = mapped.length
    ? mapped
    : Array.isArray(rawFromApi)
      ? rawFromApi
      : [];

  return rawCabs
    .filter((cab) => (cab.is_active ?? cab.isActive) !== false)
    .map(mapPackageCabFromRaw)
    .sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      if ((a.sortOrder || 0) !== (b.sortOrder || 0)) return (a.sortOrder || 0) - (b.sortOrder || 0);
      return (a.priceDelta || 0) - (b.priceDelta || 0);
    });
}
