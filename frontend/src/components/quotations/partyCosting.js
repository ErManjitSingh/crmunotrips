import { resolveCabAbsoluteFare, resolveCabUpgradeCost } from '../../lib/packageCabMapper';
import { sumDayWiseHotelRackTotal } from './DayWiseHotelSelector';
import { resolveExtraBedNightRate } from '../../lib/mealPlanDefaults';

/**
 * Party-size costing: per-person package, 2 adults/room + mattress for odd, cab by seats.
 */

function round2(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

/** Twin share without extra bed. */
export const BASE_ADULTS_PER_ROOM = 2;
/** Extra mattresses after 2 adults — up to 6 people in one room (2 + 4 mattresses). */
export const MAX_EXTRA_MATTRESSES_PER_ROOM = 4;
export const MAX_ADULTS_PER_ROOM_WITH_MATTRESS = BASE_ADULTS_PER_ROOM + MAX_EXTRA_MATTRESSES_PER_ROOM;

export function clampExtraMattresses(n = 0) {
  return Math.max(0, Math.min(MAX_EXTRA_MATTRESSES_PER_ROOM, Math.floor(Number(n) || 0)));
}

/**
 * Pack extra adults onto existing rooms with extra mattresses
 * e.g. 5 adults in 1 room → 3 mattresses.
 */
export function resolveMattressPackedOccupancy(lead = {}, configuredRooms = 1) {
  const occ = resolvePartyOccupancy(lead);
  const rooms = Math.max(1, Number(configuredRooms) || 1);
  const extra = Math.max(0, occ.adults - rooms * BASE_ADULTS_PER_ROOM);
  return {
    ...occ,
    rooms,
    mattresses: extra,
    stayWithMattress: true,
    canPack: occ.adults <= rooms * MAX_ADULTS_PER_ROOM_WITH_MATTRESS,
  };
}

export function canStayWithExtraMattress(lead = {}, configuredRooms = 1) {
  const packed = resolveMattressPackedOccupancy(lead, configuredRooms);
  return packed.canPack && packed.mattresses > 0;
}

/**
 * 2 adults share a room; odd adult gets an extra mattress (not a full extra room).
 * Prefers lead.numberOfRooms / roomsWithMattress when set.
 */
export function resolvePartyOccupancy(lead = {}) {
  const adults = Math.max(1, Number(lead?.adults ?? lead?.travelers ?? 1) || 1);
  const children = Math.max(0, Number(lead?.children) || 0);
  const travelers = adults + children;

  const roomsFromLead = Number(lead?.numberOfRooms);
  const mattressFromLead = Number(lead?.roomsWithMattress);

  let rooms;
  let mattresses;

  if (Number.isFinite(roomsFromLead) && roomsFromLead > 0) {
    rooms = Math.max(1, Math.floor(roomsFromLead));
    mattresses =
      Number.isFinite(mattressFromLead) && mattressFromLead >= 0
        ? Math.floor(mattressFromLead)
        : adults > 1
          ? adults % 2
          : 0;
  } else if (adults === 1) {
    rooms = 1;
    mattresses = 0;
  } else {
    rooms = Math.max(1, Math.floor(adults / 2));
    mattresses = adults % 2;
  }

  return { adults, children, travelers, rooms, mattresses };
}

export function resolveCabCount(travelers = 1, seats = 4) {
  const pax = Math.max(1, Number(travelers) || 1);
  const capacity = Math.max(1, Number(seats) || 4);
  return Math.max(1, Math.ceil(pax / capacity));
}

/** Website packages are listed per couple (2 adults). */
export function resolveCoupleUnits(lead = {}) {
  const adults = Math.max(1, Number(lead?.adults ?? lead?.travelers ?? 1) || 1);
  return Math.max(1, Math.ceil(adults / 2));
}

/** Listed Uno/CRM package price → per-adult rate (use unmargined base when available). */
export function resolvePerPersonPackageRate(pkg = {}) {
  const listed =
    Number(pkg?.baseStartingPrice ?? pkg?.startingPrice ?? pkg?.basePrice ?? 0) || 0;
  const pricePer = String(pkg?.pricePer || pkg?.price_per || 'per_couple').toLowerCase();
  if (
    pricePer.includes('person') ||
    pricePer.includes('pax') ||
    pricePer.includes('adult') ||
    pricePer === 'each'
  ) {
    return round2(listed);
  }
  // per_couple / twin / default — listed price is for 2 adults
  return round2(listed / 2);
}

/** Mattress surcharge from hotel API extra_bed rates (same meal plan as the room). */
export function estimateMattressCost(dayWiseHotels = [], mattresses = 0) {
  const list = Array.isArray(dayWiseHotels) ? dayWiseHotels : [];
  const nightRateFor = (item) => {
    const nights = Math.max(1, Number(item?.nights) || 1);
    const mealKey = item?.mealPlan?.key || item?.mealPlanKey || item?.meals || 'map';
    return resolveExtraBedNightRate(item, mealKey) * nights;
  };

  const hasPerLine = list.some((item) => Number(item?.extraMattresses) > 0);
  if (hasPerLine) {
    return round2(
      list.reduce((sum, item) => {
        const extra = clampExtraMattresses(item?.extraMattresses);
        if (!extra) return sum;
        return sum + nightRateFor(item) * extra;
      }, 0)
    );
  }

  const mats = Math.max(0, Number(mattresses) || 0);
  if (!mats) return 0;
  const perMattress = list.reduce((sum, item) => sum + nightRateFor(item), 0);
  return round2(perMattress * mats);
}

/**
 * Scale website package price + upgrade deltas to lead party size.
 * baseCost = unmargined website package price × couple units.
 */
export function applyPartyCosting({
  unitBaseCost = 0,
  unitHotelCost = 0,
  unitCabCost = 0,
  flightCost = 0,
  activityCost = 0,
  lead = {},
  pkg = {},
  cabSeats = 4,
  dayWiseHotels = [],
} = {}) {
  const occ = resolvePartyOccupancy(lead);
  const coupleUnits = resolveCoupleUnits(lead);
  const perPersonRate = resolvePerPersonPackageRate(pkg);
  const cabCount = resolveCabCount(occ.travelers, cabSeats);
  const mattressCost = estimateMattressCost(dayWiseHotels, occ.mattresses);

  const baseCost = round2(Number(unitBaseCost || 0) * coupleUnits);
  const hotelCost = round2(Number(unitHotelCost || 0) * occ.rooms + mattressCost);
  const cabCost = round2(Number(unitCabCost || 0) * cabCount);

  return {
    ...occ,
    perPersonRate,
    coupleUnits,
    cabCount,
    cabSeats: Math.max(1, Number(cabSeats) || 4),
    mattressCost,
    baseCost,
    hotelCost,
    cabCost,
    flightCost: round2(flightCost),
    activityCost: round2(activityCost),
  };
}

/**
 * Sidebar hotel = Σ day-wise website hotel rates (+ mattress). Cab line unchanged.
 * Admin margin is baked into sidebar lines only (not day cards).
 * Party-scaled hotel/cab totals apply only after rooms + cab capacity are configured.
 */
export function buildWebsiteAlignedQuoteCosts({
  packageAnchor = 0,
  dayWiseHotels = [],
  selectedCab = null,
  packageCabs = [],
  lead = {},
  pkg = {},
  cabSeats = 4,
  flightCost = 0,
  activityCost = 0,
  extraCabs = [],
  capacityReady = null,
  roomsReady = null,
  cabReady = null,
  capacityMessage = '',
  requiredRooms = null,
  requiredCabs = null,
  occupancyOverride = null,
} = {}) {
  void packageAnchor;
  const occ = occupancyOverride?.rooms
    ? {
        ...resolvePartyOccupancy(lead),
        rooms: Math.max(1, Number(occupancyOverride.rooms) || 1),
        mattresses: Math.max(0, Number(occupancyOverride.mattresses) || 0),
      }
    : resolvePartyOccupancy(lead);
  const seats = Math.max(1, Number(selectedCab?.seatingCapacity) || Number(cabSeats) || 4);
  const cabUpgrade = resolveCabUpgradeCost(selectedCab, packageCabs);
  const cabUnitFare = resolveCabAbsoluteFare(selectedCab, packageCabs);
  const neededCabs = resolveCabCount(occ.travelers, seats);
  const coupleUnits = resolveCoupleUnits(lead);

  const roomsOk = roomsReady == null ? true : Boolean(roomsReady);
  const cabOk = cabReady == null ? true : Boolean(cabReady);
  const ready = capacityReady == null ? roomsOk && cabOk : Boolean(capacityReady);

  // Hold party multipliers until SE configures rooms / cab for this party size.
  const effectiveRooms = roomsOk ? occ.rooms : 1;
  const effectiveMattresses = roomsOk ? occ.mattresses : 0;

  const hotelRackSum = sumDayWiseHotelRackTotal(dayWiseHotels, effectiveRooms);
  const mattressCost = estimateMattressCost(dayWiseHotels, effectiveMattresses);
  const hotelLineCost = round2(hotelRackSum + mattressCost);

  const isDefaultCab = cabUpgrade <= 0;
  let cabLineCost = 0;
  let effectiveCabCount = 1;

  if (cabOk) {
    const extraCount = Array.isArray(extraCabs) ? extraCabs.length : 0;
    effectiveCabCount = Math.max(occ.travelers <= seats ? 1 : neededCabs, 1 + extraCount);
    const primaryUnits = isDefaultCab
      ? Math.min(coupleUnits, Math.max(1, effectiveCabCount - extraCount))
      : Math.max(1, effectiveCabCount - extraCount);
    const primaryCost = cabUnitFare > 0 ? round2(cabUnitFare * primaryUnits) : 0;
    const extraCost = round2(
      (Array.isArray(extraCabs) ? extraCabs : []).reduce((sum, cab) => {
        const fare =
          Number(cab?.absoluteFare ?? cab?.totalAmount ?? cab?.cost ?? 0) || 0;
        return sum + fare;
      }, 0)
    );
    cabLineCost = round2(primaryCost + extraCost);
  } else {
    // Package base cab only — do not scale by adults yet.
    effectiveCabCount = 1;
    cabLineCost = cabUnitFare > 0 ? round2(cabUnitFare) : 0;
  }

  const party = applyPartyCosting({
    unitBaseCost: 0,
    unitHotelCost: 0,
    unitCabCost: cabUpgrade,
    flightCost,
    activityCost,
    lead,
    pkg,
    cabSeats: seats,
    dayWiseHotels,
  });

  return {
    hotelCost: hotelLineCost,
    cabCost: cabLineCost,
    flightCost: party.flightCost,
    activityCost: party.activityCost,
    party: {
      ...party,
      rooms: roomsOk ? occ.rooms : 1,
      mattresses: roomsOk ? occ.mattresses : 0,
      stayWithMattress: Boolean(occupancyOverride?.stayWithMattress),
      cabCount: effectiveCabCount,
      cabSeats: seats,
      hotelRackSum,
      mattressCost,
      capacityPending: !ready,
      capacityReady: ready,
      roomsReady: roomsOk,
      cabReady: cabOk,
      capacityMessage: capacityMessage || '',
      requiredRooms: requiredRooms != null ? requiredRooms : occ.rooms,
      requiredCabs: requiredCabs != null ? requiredCabs : neededCabs,
    },
    packageAnchor: Number(packageAnchor) || 0,
  };
}

export function perPersonFromTotal(total, adults = 1) {
  const pax = Math.max(1, Number(adults) || 1);
  return Math.round(Number(total || 0) / pax);
}
