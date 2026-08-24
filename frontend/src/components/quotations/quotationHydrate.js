import { resolveQuotePackage } from './quotePdfHelpers';
import { resolvePackageCabs } from '../../lib/packageCabMapper';
import { seedDayWiseHotelsFromItinerary } from '../../lib/packageItineraryMapper';
import { applyAskDiscount, bakeCompanyMarginIntoLineCosts, calculatePricing } from './quotationUtils';
import { resolveExtraBedNightRate } from '../../lib/mealPlanDefaults';

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
      roomSlot: Number(h.roomSlot) || 1,
      extraMattresses: Math.max(0, Math.min(4, Math.floor(Number(h.extraMattresses) || 0))),
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
      room: h.room
        ? {
            ...h.room,
            extraBedRates: h.room.extraBedRates || h.extraBedRates || null,
          }
        : null,
      mealPlan: h.mealPlan || (h.meals ? { label: h.meals, key: h.meals } : null),
      nights,
      perNight: unitPerNight,
      totalCost: unitPerNight * nights,
      absolutePerNight: absolute,
      includedRate: absolute,
      priceDelta: unitPerNight,
      extraBedRates: h.extraBedRates || h.room?.extraBedRates || null,
      extraBedPerNight: resolveExtraBedNightRate(h, h.mealPlan?.key || h.meals || 'map'),
    };
  });
}

/**
 * Rebuild cab selection from saved quotation.
 * @returns {{ primary: object|null, extraCabs: object[] }}
 */
export function hydrateCabsFromQuote(quote = {}, packageDetail = null) {
  const rows = Array.isArray(quote.selectedCabs) ? quote.selectedCabs : [];
  const packageCabs = resolvePackageCabs(packageDetail || {});

  const mapRow = (snap) => {
    if (!snap) return null;
    const unit = Number(snap.absoluteFare ?? snap.unitCost ?? snap.totalAmount ?? snap.cost ?? 0) || 0;
    const upgrade = Number(snap.upgradePrice ?? snap.priceDelta ?? 0) || 0;
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
      absoluteFare: unit,
      cost: upgrade,
      totalAmount: unit,
      priceDelta: upgrade,
      upgradePrice: upgrade,
      fare: snap.fare || {},
      externalSource: snap.externalSource || 'uno_package',
      _vehicleCount: count,
      role: snap.role || 'primary',
    };
  };

  if (!rows.length) {
    const primary = packageCabs.find((c) => c.isDefault) || packageCabs[0] || null;
    return { primary, extraCabs: [] };
  }

  const primarySnap = rows.find((r) => r.role !== 'companion') || rows[0];
  const companionSnaps = rows.filter((r) => r !== primarySnap && (r.role === 'companion' || rows.indexOf(r) > 0));
  return {
    primary: mapRow(primarySnap),
    extraCabs: companionSnaps.map(mapRow).filter(Boolean),
  };
}

/** @deprecated use hydrateCabsFromQuote */
export function hydrateCabFromQuote(quote = {}, packageDetail = null) {
  return hydrateCabsFromQuote(quote, packageDetail).primary;
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
  const hydratedCabs = hydrateCabsFromQuote(quote, packageDetail);
  const selectedUnoCab = hydratedCabs.primary;
  const extraCabs = hydratedCabs.extraCabs;

  const selectedFlightIds = (quote.selectedFlights || [])
    .map((f) => String(f._id || f.id || f))
    .filter(Boolean);
  const selectedActivityIds = (quote.selectedActivities || [])
    .map((a) => String(a._id || a.id || a))
    .filter(Boolean);

  const adminPct =
    Number(
      quote.pricing?.adminMarginPercent ??
        quote.pricing?.companyMarginBakedPercent ??
        pkg.destinationMarginPercent ??
        0
    ) || 0;

  let pricing = {
    ...(quote.pricing || {}),
    markupPercent: Number(quote.pricing?.markupPercent ?? quote.costing1?.markupPercent ?? 0) || 0,
    gstEnabled: Boolean(quote.pricing?.gstEnabled),
    askDiscount: Boolean(quote.pricing?.askDiscount),
    autoDiscountAmount: Number(quote.pricing?.autoDiscountAmount || 0) || 0,
    extraDiscount: Number(quote.pricing?.extraDiscount || 0) || 0,
    extraDiscountPending: Boolean(quote.pricing?.extraDiscountPending),
  };

  if (!pricing.companyMarginBaked && adminPct > 0) {
    pricing = bakeCompanyMarginIntoLineCosts(pricing, adminPct);
  } else if (pricing.companyMarginBaked) {
    pricing = { ...pricing, adminMarginPercent: 0 };
  }

  pricing = applyAskDiscount(pricing);
  pricing = { ...pricing, ...calculatePricing(pricing) };

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
    extraCabs,
    selectedFlightIds,
    selectedActivityIds,
    customizations: quote.customizations || '',
    pricing,
    quoteNumber: quote.quoteNumber || '',
    status: quote.status || 'draft',
  };
}
