const { BASE_URL } = require('./unoHotelsApiClient');

const OPS_BASE = (process.env.UNO_HOTELS_OPS_API_BASE_URL || BASE_URL).replace(/\/$/, '');
const OVERRIDE_CHANNEL = (process.env.UNO_HOTELS_RATE_OVERRIDE_CHANNEL || 'staff').toLowerCase();
const CACHE_TTL_MS = 15 * 60 * 1000;

let cachedOpsToken = null;
let tokenExpiresAt = 0;
const overrideCache = new Map();

function opsCredentialsConfigured() {
  const user = process.env.UNO_HOTELS_OPS_USERNAME || process.env.OPS_USERNAME;
  const pass = process.env.UNO_HOTELS_OPS_PASSWORD || process.env.OPS_PASSWORD;
  return Boolean(user && pass);
}

async function getOpsToken() {
  if (!opsCredentialsConfigured()) return null;
  if (cachedOpsToken && Date.now() < tokenExpiresAt) return cachedOpsToken;

  const username = process.env.UNO_HOTELS_OPS_USERNAME || process.env.OPS_USERNAME;
  const password = process.env.UNO_HOTELS_OPS_PASSWORD || process.env.OPS_PASSWORD;

  const res = await fetch(`${OPS_BASE}/ops/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return null;

  const token = json.access_token || json.data?.access_token;
  if (!token) return null;

  cachedOpsToken = token;
  tokenExpiresAt = Date.now() + Math.max(60, Number(json.expires_in || 3600) - 60) * 1000;
  return token;
}

function normalizeYmd(value) {
  if (!value) return '';
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function normalizeMealRates(rates = {}) {
  if (!rates || typeof rates !== 'object') return null;
  const ep = Number(rates.ep || 0);
  const cp = Number(rates.cp || 0);
  const mapRate = Number(rates.map || 0);
  const ap = Number(rates.ap || 0);
  if (!ep && !cp && !mapRate && !ap) return null;
  return { ep, cp, map: mapRate, ap };
}

/**
 * Pick the ops rate-override row for a stay night (staff/agent/website channel).
 */
function pickRateOverride(overrides = [], { channel = OVERRIDE_CHANNEL, date = '' } = {}) {
  const list = Array.isArray(overrides) ? overrides : [];
  if (!list.length) return null;

  const ymd = normalizeYmd(date) || new Date().toISOString().slice(0, 10);
  const channelRows = list.filter((row) => String(row.channel || '').toLowerCase() === channel);
  const rows = channelRows.length ? channelRows : list;

  return (
    rows.find((row) => {
      const start = normalizeYmd(row.start_date);
      const end = normalizeYmd(row.end_date);
      if (!start || !end) return false;
      return ymd >= start && ymd <= end;
    }) || null
  );
}

async function fetchRoomRateOverrides(propertyId, roomTypeId) {
  if (!propertyId || !roomTypeId || !opsCredentialsConfigured()) return [];

  const cacheKey = `${propertyId}:${roomTypeId}`;
  const cached = overrideCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.overrides;
  }

  const token = await getOpsToken();
  if (!token) return [];

  try {
    const res = await fetch(
      `${OPS_BASE}/ops/v1/properties/${encodeURIComponent(propertyId)}/room-types/${encodeURIComponent(roomTypeId)}/rate-overrides`,
      { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } }
    );
    if (res.status === 404) {
      overrideCache.set(cacheKey, { fetchedAt: Date.now(), overrides: [] });
      return [];
    }
    const json = await res.json().catch(() => []);
    if (!res.ok) return [];

    const overrides = Array.isArray(json) ? json : json.data || json.items || [];
    overrideCache.set(cacheKey, { fetchedAt: Date.now(), overrides });
    return overrides;
  } catch {
    return [];
  }
}

/**
 * Merge ops override into public API room.rates.website so existing mapRoom() picks it up.
 * Only called when override rows exist for this room.
 */
function applyRateOverrideToRoom(room = {}, override = null) {
  if (!override?.room) return room;

  const roomRates = normalizeMealRates(override.room);
  const extraBedRates = normalizeMealRates(override.extra_bed);
  if (!roomRates) return room;

  const existing = room.rates && typeof room.rates === 'object' ? room.rates : {};
  const website = existing.website && typeof existing.website === 'object' ? existing.website : {};

  return {
    ...room,
    rates: {
      ...existing,
      website: {
        ...website,
        room: roomRates,
        extra_bed: website.extra_bed || extraBedRates,
      },
    },
    _opsRateOverride: {
      id: override.id,
      channel: override.channel || OVERRIDE_CHANNEL,
      startDate: override.start_date,
      endDate: override.end_date,
    },
  };
}

/**
 * For each room, fetch ops rate-overrides; apply only when overrides exist.
 */
async function applyOpsRateOverridesToHotel(hotel = {}, { checkIn = '', channel = OVERRIDE_CHANNEL } = {}) {
  if (!hotel?.id || !opsCredentialsConfigured()) return hotel;
  const rooms = Array.isArray(hotel.rooms) ? hotel.rooms : [];
  if (!rooms.length) return hotel;

  const stayDate = normalizeYmd(checkIn) || new Date().toISOString().slice(0, 10);
  let changed = false;

  const nextRooms = await Promise.all(
    rooms.map(async (room) => {
      const roomId = room?.id || room?.room_type_id;
      if (!roomId) return room;

      const overrides = await fetchRoomRateOverrides(hotel.id, roomId);
      if (!overrides.length) return room;

      const picked = pickRateOverride(overrides, { channel, date: stayDate });
      if (!picked) return room;

      changed = true;
      return applyRateOverrideToRoom(room, picked);
    })
  );

  return changed ? { ...hotel, rooms: nextRooms } : hotel;
}

module.exports = {
  opsCredentialsConfigured,
  pickRateOverride,
  fetchRoomRateOverrides,
  applyRateOverrideToRoom,
  applyOpsRateOverridesToHotel,
};
