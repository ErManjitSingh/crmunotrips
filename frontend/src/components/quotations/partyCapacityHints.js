import {
  resolvePartyOccupancy,
  resolveCabCount,
  BASE_ADULTS_PER_ROOM,
  MAX_EXTRA_MATTRESSES_PER_ROOM,
  clampExtraMattresses,
} from './partyCosting';

/**
 * Cab capacity hint for sales executives when party exceeds default cab seats.
 */
export function getCabCapacityHint(lead = {}, packageCab = null, party = null, extraCabs = []) {
  const occ = party?.travelers
    ? {
        adults: Number(party.adults) || 1,
        children: Number(party.children) || 0,
        travelers: Number(party.travelers) || 1,
        rooms: Number(party.rooms) || 1,
        mattresses: Number(party.mattresses) || 0,
      }
    : resolvePartyOccupancy(lead);

  const seats = Math.max(1, Number(packageCab?.seatingCapacity) || Number(party?.cabSeats) || 4);
  const requiredCabs = resolveCabCount(occ.travelers, seats);
  const configuredCabs = Math.max(1, 1 + (Array.isArray(extraCabs) ? extraCabs.length : 0));
  const fitsInOne = occ.travelers <= seats;
  const needsAction = !fitsInOne && configuredCabs < requiredCabs;

  let message = '';
  if (needsAction) {
    if (requiredCabs > 1) {
      message = `${occ.travelers} traveler${occ.travelers === 1 ? '' : 's'} need ${requiredCabs} cabs (${seats} seats each). Please change your cab or add a new cab.`;
    } else {
      message = `${occ.travelers} travelers exceed this cab's ${seats}-seat capacity. Please change your cab or add a new cab.`;
    }
  }

  return {
    needsAction,
    travelers: occ.travelers,
    seats,
    cabCount: requiredCabs,
    configuredCabs,
    message,
  };
}

/**
 * Hotel room hint when party needs more than one room.
 * Also offers extra-mattress stay when 3–5 adults can share existing rooms.
 */
export function getHotelRoomHint(lead = {}, party = null, configuredRoomLines = 1, extraMattresses = 0) {
  const fromLead = resolvePartyOccupancy(lead);
  const configured = Math.max(1, Number(configuredRoomLines) || 1);
  const matsOnRooms = Math.max(0, Number(extraMattresses) || 0);
  const stayWithMattress = matsOnRooms > 0 || Boolean(party?.stayWithMattress);
  const adults = Number(party?.adults ?? fromLead.adults) || 1;
  const capacity = configured * BASE_ADULTS_PER_ROOM + matsOnRooms;
  const defaultRequired = Math.max(1, Number(fromLead.rooms) || 1);
  const needsAction = adults > capacity;

  let message = '';
  if (needsAction) {
    message = `${adults} adult${adults === 1 ? '' : 's'} · ${configured} room${configured === 1 ? '' : 's'} hold ${capacity} (2 per room${matsOnRooms ? ` + ${matsOnRooms} mattress` : ''}). Add extra mattress beside the room (3–6 pax) or add another room.`;
  } else if (matsOnRooms > 0) {
    message = `${adults} adult${adults === 1 ? '' : 's'} in ${configured} room${configured === 1 ? '' : 's'} with ${matsOnRooms} extra mattress${matsOnRooms === 1 ? '' : 'es'}.`;
  }

  return {
    needsAction,
    requiredRooms: defaultRequired,
    configuredRooms: configured,
    mattresses: matsOnRooms,
    adults,
    message,
    canStayWithMattress:
      adults > configured * BASE_ADULTS_PER_ROOM &&
      adults <= configured * (BASE_ADULTS_PER_ROOM + MAX_EXTRA_MATTRESSES_PER_ROOM),
    extraMattresses: matsOnRooms,
    stayWithMattress,
    occupancyCapacity: capacity,
  };
}

export function countRoomLinesForDay(dayWiseHotels = [], dayNum = 1) {
  return (Array.isArray(dayWiseHotels) ? dayWiseHotels : []).filter(
    (h) => Number(h.day) === Number(dayNum)
  ).length;
}

export function getRoomLinesForDay(dayWiseHotels = [], dayNum = 1) {
  return (Array.isArray(dayWiseHotels) ? dayWiseHotels : [])
    .filter((h) => Number(h.day) === Number(dayNum))
    .sort((a, b) => Number(a.roomSlot || 1) - Number(b.roomSlot || 1));
}

export function extraMattressesOnLine(line = {}) {
  return clampExtraMattresses(line?.extraMattresses);
}

export function extraMattressesForDay(dayWiseHotels = [], dayNum = 1) {
  return getRoomLinesForDay(dayWiseHotels, dayNum).reduce(
    (sum, line) => sum + extraMattressesOnLine(line),
    0
  );
}

export function occupancyCapacityForDay(dayWiseHotels = [], dayNum = 1) {
  const lines = getRoomLinesForDay(dayWiseHotels, dayNum);
  const rooms = Math.max(1, lines.length || 1);
  const mattresses = extraMattressesForDay(dayWiseHotels, dayNum);
  return {
    rooms,
    mattresses,
    capacity: rooms * BASE_ADULTS_PER_ROOM + mattresses,
  };
}

/**
 * Party capacity is ready when overnight stays have enough room lines
 * and cab seating / extra cabs cover all travelers.
 * Pricing sidebar should stay on package base until ready.
 */
export function getPartyCapacityReadiness({
  lead = {},
  party = null,
  dayWiseHotels = [],
  itinerary = [],
  selectedCab = null,
  extraCabs = [],
  cabSeats = 4,
  stayWithMattress: _stayWithMattress = false,
} = {}) {
  const fromLead = resolvePartyOccupancy(lead);
  const adults = Math.max(1, Number(fromLead.adults) || 1);
  const defaultRequiredRooms = Math.max(1, Number(fromLead.rooms) || 1);
  let requiredRooms = defaultRequiredRooms;
  const seats = Math.max(
    1,
    Number(selectedCab?.seatingCapacity) || Number(cabSeats) || Number(party?.cabSeats) || 4
  );
  const travelers = fromLead.travelers;
  const requiredCabs = resolveCabCount(travelers, seats);
  const configuredCabs = Math.max(1, 1 + (Array.isArray(extraCabs) ? extraCabs.length : 0));
  const cabReady = travelers <= seats || configuredCabs >= requiredCabs;

  const overnightDays = (() => {
    const days = Array.isArray(itinerary) ? itinerary : [];
    if (days.length > 1) {
      // Last itinerary day is usually departure (no overnight).
      return days.slice(0, -1).map((d, i) => Number(d.day) || i + 1);
    }
    if (days.length === 1) return [Number(days[0].day) || 1];

    const fromHotels = [
      ...new Set(
        (Array.isArray(dayWiseHotels) ? dayWiseHotels : [])
          .map((h) => Number(h.day) || 0)
          .filter((d) => d > 0)
      ),
    ];
    return fromHotels.sort((a, b) => a - b);
  })();

  const roomGaps = overnightDays.map((dayNum) => {
    const stay = occupancyCapacityForDay(dayWiseHotels, dayNum);
    return {
      day: dayNum,
      configured: stay.rooms,
      mattresses: stay.mattresses,
      capacity: stay.capacity,
      missing: Math.max(0, adults - stay.capacity),
    };
  });

  const minConfigured =
    roomGaps.length > 0
      ? roomGaps.reduce((minCfg, g) => Math.min(minCfg, g.configured), defaultRequiredRooms)
      : 1;
  const extraMats =
    roomGaps.length > 0
      ? Math.min(...roomGaps.map((g) => g.mattresses))
      : extraMattressesForDay(dayWiseHotels, 1);
  const mattressStay = extraMats > 0;
  if (mattressStay) {
    requiredRooms = minConfigured;
  }

  const roomsReady =
    (roomGaps.length > 0 && roomGaps.every((g) => g.capacity >= adults)) ||
    (roomGaps.length === 0 && adults <= BASE_ADULTS_PER_ROOM);

  const missingParts = [];
  if (!roomsReady) {
    missingParts.push(
      `add extra mattress beside the room (after 2 pax) or add another room so ${adults} adults fit`
    );
  }
  if (!cabReady) {
    missingParts.push(
      `change cab or add cab so ${travelers} travelers fit (${requiredCabs} × ${seats}-seater)`
    );
  }

  const ready = roomsReady && cabReady;
  return {
    ready,
    roomsReady,
    cabReady,
    requiredRooms,
    requiredCabs,
    configuredCabs,
    seats,
    travelers,
    adults,
    mattresses: extraMats,
    stayWithMattress: mattressStay && roomsReady,
    occupancyOverride: roomsReady
      ? {
          rooms: minConfigured,
          mattresses: extraMats,
          stayWithMattress: extraMats > 0,
        }
      : null,
    roomGaps,
    message: ready
      ? ''
      : `Pricing updates after you ${missingParts.join(' and ')}.`,
  };
}
