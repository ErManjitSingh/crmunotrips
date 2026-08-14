import { resolvePartyOccupancy, resolveCabCount, resolveMattressPackedOccupancy } from './partyCosting';

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
export function getHotelRoomHint(lead = {}, party = null, configuredRoomLines = 1) {
  const fromLead = resolvePartyOccupancy(lead);
  const stayWithMattress = Boolean(party?.stayWithMattress);
  const configured = Math.max(0, Number(configuredRoomLines) || 0) || 1;
  const packed = resolveMattressPackedOccupancy(lead, configured);
  const defaultRequired = Math.max(1, Number(fromLead.rooms) || 1);
  const requiredRooms = stayWithMattress
    ? configured
    : Math.max(1, Number(party?.requiredRooms ?? party?.rooms ?? fromLead.rooms) || 1);

  const occ = {
    adults: Number(party?.adults ?? fromLead.adults) || 1,
    children: Number(party?.children ?? fromLead.children) || 0,
    travelers: Number(party?.travelers ?? fromLead.travelers) || 1,
    rooms: requiredRooms,
  };

  const mats = stayWithMattress
    ? packed.mattresses
    : Number(
        party?.capacityPending
          ? fromLead.mattresses
          : party?.mattresses ?? fromLead.mattresses
      ) || 0;

  const needsAction = !stayWithMattress && configured < requiredRooms;
  const canStayWithMattress =
    !stayWithMattress && packed.canPack && packed.mattresses > 0 && configured < defaultRequired;

  let message = '';
  if (stayWithMattress) {
    message = `${occ.adults} adult${occ.adults === 1 ? '' : 's'} staying in ${configured} room${configured === 1 ? '' : 's'} with ${packed.mattresses} extra mattress${packed.mattresses === 1 ? '' : 'es'}.`;
  } else if (needsAction) {
    const parts = [
      `${occ.adults} adult${occ.adults === 1 ? '' : 's'} need ${requiredRooms} room${requiredRooms === 1 ? '' : 's'}`,
    ];
    if (mats > 0) {
      parts.push(`${mats} extra mattress${mats === 1 ? '' : 'es'}`);
    }
    parts.push(
      configured > 0
        ? `only ${configured} room line${configured === 1 ? '' : 's'} added so far`
        : 'no extra room added yet'
    );
    if (canStayWithMattress) {
      parts.push(
        `or ${occ.adults} can stay in ${configured} room${configured === 1 ? '' : 's'} with extra mattress`
      );
    }
    message = `${parts.join(' · ')}. Please add rooms or extra mattress for correct pricing.`;
  }

  return {
    needsAction,
    requiredRooms,
    configuredRooms: configured,
    mattresses: mats,
    adults: occ.adults,
    message,
    canStayWithMattress,
    extraMattresses: packed.mattresses,
    stayWithMattress,
  };
}

export function countRoomLinesForDay(dayWiseHotels = [], dayNum = 1) {
  return (Array.isArray(dayWiseHotels) ? dayWiseHotels : []).filter(
    (h) => Number(h.day) === Number(dayNum)
  ).length;
}

export function getRoomLinesForDay(dayWiseHotels = [], dayNum = 1) {
  const lines = (Array.isArray(dayWiseHotels) ? dayWiseHotels : [])
    .filter((h) => Number(h.day) === Number(dayNum))
    .sort((a, b) => Number(a.roomSlot || 1) - Number(b.roomSlot || 1));
  return lines;
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
  stayWithMattress = false,
} = {}) {
  const occ = party?.travelers
    ? {
        adults: Number(party.adults) || 1,
        children: Number(party.children) || 0,
        travelers: Number(party.travelers) || 1,
        rooms: Number(party.rooms) || 1,
        mattresses: Number(party.mattresses) || 0,
      }
    : resolvePartyOccupancy(lead);

  const defaultRequiredRooms = Math.max(1, Number(resolvePartyOccupancy(lead).rooms) || 1);
  let requiredRooms = defaultRequiredRooms;
  const seats = Math.max(
    1,
    Number(selectedCab?.seatingCapacity) || Number(cabSeats) || Number(party?.cabSeats) || 4
  );
  const requiredCabs = resolveCabCount(occ.travelers, seats);
  const configuredCabs = Math.max(1, 1 + (Array.isArray(extraCabs) ? extraCabs.length : 0));
  const cabReady = occ.travelers <= seats || configuredCabs >= requiredCabs;

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
    const lines = countRoomLinesForDay(dayWiseHotels, dayNum);
    // Package may seed hotel on itinerary without a dayWiseHotels row yet → count as 1.
    const configured = lines > 0 ? lines : 1;
    return { day: dayNum, configured, missing: Math.max(0, requiredRooms - configured) };
  });

  const minConfigured =
    roomGaps.length > 0
      ? roomGaps.reduce((minCfg, g) => Math.min(minCfg, g.configured), requiredRooms)
      : 1;

  const packed = resolveMattressPackedOccupancy(lead, minConfigured);
  const mattressStay =
    Boolean(stayWithMattress || party?.stayWithMattress) && packed.canPack;

  if (mattressStay) {
    requiredRooms = minConfigured;
  }

  const roomsReady =
    mattressStay ||
    requiredRooms <= 1 ||
    (roomGaps.length > 0 && roomGaps.every((g) => g.configured >= requiredRooms));

  const missingParts = [];
  if (!roomsReady) {
    const worst = minConfigured;
    missingParts.push(
      `add ${requiredRooms} room${requiredRooms === 1 ? '' : 's'} on each hotel night (now ${worst}) or stay with extra mattress`
    );
  }
  if (!cabReady) {
    missingParts.push(
      `change cab or add cab so ${occ.travelers} travelers fit (${requiredCabs} × ${seats}-seater)`
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
    travelers: occ.travelers,
    adults: occ.adults,
    mattresses: mattressStay ? packed.mattresses : occ.mattresses,
    stayWithMattress: mattressStay,
    occupancyOverride: mattressStay
      ? { rooms: packed.rooms, mattresses: packed.mattresses, stayWithMattress: true }
      : null,
    roomGaps,
    message: ready
      ? ''
      : `Pricing updates after you ${missingParts.join(' and ')}.`,
  };
}
