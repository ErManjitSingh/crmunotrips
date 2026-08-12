import { resolvePartyOccupancy, resolveCabCount } from './partyCosting';

/**
 * Cab capacity hint for sales executives when party exceeds default cab seats.
 */
export function getCabCapacityHint(lead = {}, packageCab = null, party = null) {
  const occ = party?.travelers
    ? {
        adults: Number(party.adults) || 1,
        children: Number(party.children) || 0,
        travelers: Number(party.travelers) || 1,
        rooms: Number(party.rooms) || 1,
        mattresses: Number(party.mattresses) || 0,
      }
    : resolvePartyOccupancy(lead);

  const seats = Math.max(1, Number(packageCab?.seatingCapacity) || 4);
  const cabCount = Number(party?.cabCount) || resolveCabCount(occ.travelers, seats);
  const needsAction = cabCount > 1 || occ.travelers > seats;

  let message = '';
  if (needsAction) {
    if (cabCount > 1) {
      message = `${occ.travelers} traveler${occ.travelers === 1 ? '' : 's'} need ${cabCount} cabs (${seats} seats each). Please change your cab or add a new cab.`;
    } else {
      message = `${occ.travelers} travelers exceed this cab's ${seats}-seat capacity. Please change your cab or add a new cab.`;
    }
  }

  return {
    needsAction,
    travelers: occ.travelers,
    seats,
    cabCount,
    message,
  };
}

/**
 * Hotel room hint when party needs more than one room / extra mattress.
 */
export function getHotelRoomHint(lead = {}, party = null, configuredRoomLines = 1) {
  const occ = party?.rooms
    ? {
        adults: Number(party.adults) || 1,
        children: Number(party.children) || 0,
        travelers: Number(party.travelers) || 1,
        rooms: Number(party.rooms) || 1,
        mattresses: Number(party.mattresses) || 0,
      }
    : resolvePartyOccupancy(lead);

  const requiredRooms = Math.max(1, Number(occ.rooms) || 1);
  const configured = Math.max(1, Number(configuredRoomLines) || 1);
  const needsAction = requiredRooms > 1 || occ.mattresses > 0 || configured < requiredRooms;

  let message = '';
  if (needsAction) {
    const parts = [`${occ.adults} adult${occ.adults === 1 ? '' : 's'} need ${requiredRooms} room${requiredRooms === 1 ? '' : 's'}`];
    if (occ.mattresses > 0) {
      parts.push(`${occ.mattresses} extra mattress${occ.mattresses === 1 ? '' : 'es'}`);
    }
    if (configured < requiredRooms) {
      parts.push(`only ${configured} room line${configured === 1 ? '' : 's'} added so far`);
    }
    message = `${parts.join(' · ')}. Please add rooms for correct pricing.`;
  }

  return {
    needsAction,
    requiredRooms,
    configuredRooms: configured,
    mattresses: occ.mattresses,
    adults: occ.adults,
    message,
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
