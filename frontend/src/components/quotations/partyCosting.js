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
      item?.absolutePerNight ?? item?.hotel?.startingPrice ?? item?.includedRate ?? 0
    );
    const explicit =
      Number(item?.extraBedPerNight ?? item?.room?.extraBedRate ?? item?.mealPlan?.extraBed ?? 0) || 0;
    const nightRate = explicit > 0 ? explicit : absolute * 0.35;
    return sum + nightRate * nights;
  }, 0);

  return round2(perMattress * mats);
}

/**
 * Scale unit (1 couple / 1 room / 1 cab) costs to lead party size.
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
  const perPersonRate = resolvePerPersonPackageRate(pkg);
  const listed =
    Number(pkg?.baseStartingPrice ?? pkg?.startingPrice ?? pkg?.basePrice ?? 0) || 0;
  const cabCount = resolveCabCount(occ.travelers, cabSeats);
  const mattressCost = estimateMattressCost(dayWiseHotels, occ.mattresses);

  // Package share: always per-adult × adults when a listed package price exists.
  // Hotel upgrades / peeled absolutes scale by rooms (+ mattress).
  let baseCost;
  let hotelCost;

  if (listed > 0) {
    const partyPackage = round2(perPersonRate * occ.adults);
    const peeled = unitHotelCost > 0 && unitBaseCost < listed - 1;
    if (peeled) {
      // Unit residual is non-hotel package share for the listed unit (usually couple).
      const residualPerPerson = round2(unitBaseCost / 2);
      baseCost = round2(residualPerPerson * occ.adults);
      hotelCost = round2(unitHotelCost * occ.rooms + mattressCost);
    } else {
      baseCost = partyPackage;
      hotelCost = round2(unitHotelCost * occ.rooms + mattressCost);
    }
  } else {
    baseCost = round2(unitBaseCost);
    hotelCost = round2(unitHotelCost * occ.rooms + mattressCost);
  }

  const cabCost = round2(Number(unitCabCost || 0) * cabCount);

  return {
    ...occ,
    perPersonRate,
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

export function perPersonFromTotal(total, adults = 1) {
  const pax = Math.max(1, Number(adults) || 1);
  return Math.round(Number(total || 0) / pax);
}
