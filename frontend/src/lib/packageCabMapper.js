function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function rawCabList(source = {}) {
  const mapped = Array.isArray(source.packageCabs)
    ? source.packageCabs
    : Array.isArray(source.package_cabs)
      ? source.package_cabs
      : [];

  const rawFromApi = source._apiRaw?.dayOptions?.cabs;
  if (mapped.length) return mapped;
  if (Array.isArray(rawFromApi)) return rawFromApi;
  return [];
}

/**
 * UNO day-options cabs:
 * - price_delta = absolute cab fare for that vehicle
 * - upgrade_price = extra vs default (0 for default cab)
 * Default cab fare is already inside package base — peel it for display, add only upgrades on top.
 */
export function mapPackageCabFromRaw(cab = {}, { defaultAbsolute = null } = {}) {
  if (cab.isPackageCab || cab.externalSource === 'uno_package') {
    // Already mapped — refresh absolute/upgrade if raw-like fields present
    if (cab.absoluteFare != null || cab.priceDelta != null) return cab;
  }

  const absolute = toNumber(
    cab.absoluteFare ?? cab.price_delta ?? cab.totalAmount ?? cab.cost ?? cab.priceDelta,
    0
  );
  const explicitUpgrade = cab.upgrade_price ?? cab.upgradePrice;
  const upgrade =
    explicitUpgrade != null && explicitUpgrade !== ''
      ? toNumber(explicitUpgrade, 0)
      : defaultAbsolute != null && defaultAbsolute > 0
        ? Math.max(0, absolute - Number(defaultAbsolute))
        : 0;

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
    /** Absolute trip fare for this cab (from UNO price_delta). */
    absoluteFare: absolute,
    /** Only the upgrade vs package-default cab (adds on top of peeled included fare). */
    cost: upgrade,
    totalAmount: absolute,
    priceDelta: upgrade,
    upgradePrice: upgrade,
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
  const rawCabs = rawCabList(source).filter((cab) => (cab.is_active ?? cab.isActive) !== false);

  const defaultRaw =
    rawCabs.find((c) => c.is_default || c.isDefault) || rawCabs[0] || null;
  const defaultAbsolute = defaultRaw
    ? toNumber(defaultRaw.absoluteFare ?? defaultRaw.price_delta ?? defaultRaw.totalAmount, 0)
    : 0;

  return rawCabs
    .map((cab) => mapPackageCabFromRaw(cab, { defaultAbsolute }))
    .sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      if ((a.sortOrder || 0) !== (b.sortOrder || 0)) return (a.sortOrder || 0) - (b.sortOrder || 0);
      return (a.absoluteFare || 0) - (b.absoluteFare || 0);
    });
}

/**
 * Peel included (default) cab fare out of package residual and itemize selected cab absolute.
 * @returns {{ baseCost: number, cabCost: number, includedCabFare: number }}
 */
export function resolvePackageCabPricing(packageBaseAfterHotels = 0, selectedCab = null, packageCabs = []) {
  const packageBase = Math.max(0, Number(packageBaseAfterHotels) || 0);
  const cabs = Array.isArray(packageCabs) ? packageCabs : [];
  const defaultCab = cabs.find((c) => c.isDefault) || cabs[0] || null;
  const included = Math.max(
    0,
    Number(defaultCab?.absoluteFare ?? defaultCab?.totalAmount ?? 0) || 0
  );
  const selectedAbs = Math.max(
    0,
    Number(
      selectedCab?.absoluteFare ??
        selectedCab?.totalAmount ??
        selectedCab?.cost ??
        0
    ) || 0
  );
  const upgrade = Math.max(
    0,
    Number(selectedCab?.upgradePrice ?? selectedCab?.priceDelta ?? selectedCab?.cost ?? 0) || 0
  );

  // Prefer absolute selected fare; fall back to included + upgrade.
  const cabAbsolute = selectedAbs > 0 ? selectedAbs : included + upgrade;

  if (included > 0 && included <= packageBase + 0.01) {
    return {
      baseCost: Math.round((packageBase - included) * 100) / 100,
      cabCost: Math.round(cabAbsolute * 100) / 100,
      includedCabFare: included,
    };
  }

  // Cannot peel — only charge upgrade delta (legacy / missing absolute).
  return {
    baseCost: packageBase,
    cabCost: Math.round((upgrade || (selectedAbs > 0 && included <= 0 ? selectedAbs : 0)) * 100) / 100,
    includedCabFare: 0,
  };
}
