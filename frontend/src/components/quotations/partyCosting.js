import { resolveCabAbsoluteFare, resolveCabUpgradeCost } from '../../lib/packageCabMapper';
import { resolvePackageHotelPricing } from './DayWiseHotelSelector';

/**
 * Party-size costing: per-person package, 2 adults/room + mattress for odd, cab by seats.
 */

function round2(n) {
  return Math.round(Number(n || 0) * 100) / 100;
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

/** Mattress surcharge from day-wise hotel absolutes (≈35% of room night when no extra-bed rate). */
export function estimateMattressCost(dayWiseHotels = [], mattresses = 0) {
  const mats = Math.max(0, Number(mattresses) || 0);
  if (!mats) return 0;

  const perMattress = (Array.isArray(dayWiseHotels) ? dayWiseHotels : []).reduce((sum, item) => {
    const nights = Math.max(1, Number(item?.nights) || 1);
    const absolute = Number(
      item?.absolutePerNight || item?.includedRate || 0
    );
    const explicit =
      Number(item?.extraBedPerNight ?? item?.room?.extraBedRate ?? item?.mealPlan?.extraBed ?? 0) || 0;
    const nightRate = explicit > 0 ? explicit : absolute * 0.35;
    return sum + nightRate * nights;
  }, 0);

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
 * Website-aligned quote lines: total matches UNO package price (+ upgrades).
 * Cab fare is shown on its own line; hotel/package line holds the remainder.
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
} = {}) {
  const unit = resolvePackageHotelPricing(0, dayWiseHotels);
  const cabUpgrade = resolveCabUpgradeCost(selectedCab, packageCabs);
  const cabUnitFare = resolveCabAbsoluteFare(selectedCab, packageCabs);
  const party = applyPartyCosting({
    unitBaseCost: packageAnchor,
    unitHotelCost: unit.hotelCost,
    unitCabCost: cabUpgrade,
    flightCost,
    activityCost,
    lead,
    pkg,
    cabSeats,
    dayWiseHotels,
  });

  const isDefaultCab = cabUpgrade <= 0;
  const cabUnits = isDefaultCab ? party.coupleUnits : party.cabCount;
  const cabLineCost = round2(cabUnitFare * cabUnits);
  const packageSubtotal = round2(party.baseCost + party.hotelCost + party.cabCost);
  const hotelLineCost = round2(Math.max(0, packageSubtotal - cabLineCost));

  return {
    hotelCost: hotelLineCost,
    cabCost: cabLineCost,
    flightCost: party.flightCost,
    activityCost: party.activityCost,
    party,
    packageAnchor: Number(packageAnchor) || 0,
  };
}

export function perPersonFromTotal(total, adults = 1) {
  const pax = Math.max(1, Number(adults) || 1);
  return Math.round(Number(total || 0) / pax);
}
