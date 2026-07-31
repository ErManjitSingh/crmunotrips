import { resolveQuotePackage } from './quotePdfHelpers';
import { resolvePackageCabs } from '../../lib/packageCabMapper';
import { seedDayWiseHotelsFromItinerary } from '../../lib/packageItineraryMapper';

/**
 * Rebuild day-wise hotel selections from a saved quotation snapshot.
 */
export function hydrateDayWiseHotelsFromQuote(quote = {}) {
  const rows = Array.isArray(quote.selectedHotels) ? quote.selectedHotels : [];
  if (!rows.length) {
    const pkg = resolveQuotePackage(quote);
    return seedDayWiseHotelsFromItinerary(pkg.itinerary || []);
  }

  return rows.map((h, index) => {
    const nights = Math.max(1, Number(h.nights) || 1);
    const rooms = Math.max(1, Number(h.rooms) || 1);
    const absolute = Number(h.absolutePerNight || 0) || 0;
    const unitPerNight =
      Number(h.priceDelta) ||
      (Number(h.price) && rooms ? Number(h.price) / rooms : 0) ||
      0;
    return {
      day: Number(h.day) || index + 1,
      hotel: {
        id: h._id || h.id,
        name: h.name || 'Hotel',
        location: h.location || h.city || '',
        city: h.city || '',
        rating: h.rating,
        starCategory: h.starCategory,
        reviewCount: h.reviewCount,
        thumbnailUrl: h.thumbnailUrl,
        images: h.images || [],
        externalSource: h.externalSource || 'uno_hotels',
        startingPrice: absolute || unitPerNight,
      },
      room: h.room || null,
      mealPlan: h.mealPlan || (h.meals ? { label: h.meals, key: h.meals } : null),
      nights,
      perNight: unitPerNight,
      totalCost: unitPerNight * nights,
      absolutePerNight: absolute,
      includedRate: absolute,
      priceDelta: unitPerNight,
      extraBedPerNight:
        Number(h.extraBedPerNight || h.room?.extraBedRate || 0) ||
        (absolute > 0 ? absolute * 0.35 : 0),
    };
  });
}

/**
 * Rebuild cab selection from saved quotation.
 */
export function hydrateCabFromQuote(quote = {}, packageDetail = null) {
  const snap = Array.isArray(quote.selectedCabs) ? quote.selectedCabs[0] : null;
  if (!snap) {
    const packageCabs = resolvePackageCabs(packageDetail || {});
    return packageCabs.find((c) => c.isDefault) || packageCabs[0] || null;
  }

  const unit = Number(snap.unitCost ?? snap.totalAmount ?? snap.cost ?? 0) || 0;
  const count = Math.max(1, Number(snap.vehicleCount) || 1);
  return {
    id: snap.packageCabId || snap.id || snap._id || snap.slug,
    slug: snap.slug,
    packageCabId: snap.packageCabId || null,
    cabTypeId: snap.cabTypeId || null,
    name: snap.name,
    vehicleType: snap.vehicleType || snap.cabCategory || snap.name,
    cabCategory: snap.cabCategory || snap.vehicleType || '',
    pickupCity: snap.pickupCity || snap.pickupLocation || '',
    dropCity: snap.dropCity || snap.dropLocation || '',
    dropState: snap.dropState || '',
    tripType: snap.tripType || 'full_day',
    travelDate: snap.travelDate || '',
    seatingCapacity: snap.seatingCapacity || 4,
    isAc: snap.isAc,
    isPackageCab: Boolean(snap.isPackageCab || snap.packageCabId),
    isDefault: Boolean(snap.isDefault),
    cost: unit,
    totalAmount: unit,
    priceDelta: snap.priceDelta,
    fare: snap.fare || {},
    externalSource: snap.externalSource || 'uno_package',
    _vehicleCount: count,
  };
}

/**
 * Map a saved quotation into QuotationBuilderWizard state.
 */
export function hydrateWizardFromQuote(quote) {
  if (!quote) return null;

  const pkg = resolveQuotePackage(quote);
  const lead = quote.lead && typeof quote.lead === 'object' ? quote.lead : null;
  const leadId = String(lead?._id || quote.lead || '');
  const packageId =
    (quote.package && typeof quote.package === 'object'
      ? quote.package._id || quote.package.id
      : quote.package) ||
    pkg._id ||
    pkg.id ||
    pkg.slug ||
    '';

  const packageDetail = {
    ...pkg,
    _id: packageId || pkg._id || pkg.id,
    id: packageId || pkg.id || pkg._id,
    packageCabs: resolvePackageCabs(pkg),
  };

  const dayWiseHotels = hydrateDayWiseHotelsFromQuote(quote);
  const selectedUnoCab = hydrateCabFromQuote(quote, packageDetail);

  const selectedFlightIds = (quote.selectedFlights || [])
    .map((f) => String(f._id || f.id || f))
    .filter(Boolean);
  const selectedActivityIds = (quote.selectedActivities || [])
    .map((a) => String(a._id || a.id || a))
    .filter(Boolean);

  return {
    leadId,
    lead,
    packageId: String(packageId || ''),
    packageDetail,
    customItinerary: (pkg.itinerary || []).map((d, i) => ({
      ...d,
      id: d.id || d._id || `day-${i + 1}`,
      day: d.day || i + 1,
    })),
    customInclusions: Array.isArray(pkg.inclusions) && pkg.inclusions.length ? [...pkg.inclusions] : [''],
    customExclusions: Array.isArray(pkg.exclusions) && pkg.exclusions.length ? [...pkg.exclusions] : [''],
    dayWiseHotels,
    selectedUnoCab,
    selectedFlightIds,
    selectedActivityIds,
    customizations: quote.customizations || '',
    pricing: {
      ...(quote.pricing || {}),
      markupPercent: Number(quote.pricing?.markupPercent ?? quote.costing1?.markupPercent ?? 0) || 0,
      gstEnabled: Boolean(quote.pricing?.gstEnabled),
    },
    quoteNumber: quote.quoteNumber || '',
    status: quote.status || 'draft',
  };
}
