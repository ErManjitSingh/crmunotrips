/** Package nights are usually MAP; last/departure day is often EP in Uno packages. */
export const DEFAULT_MEAL_PLAN_KEY = 'map';

export const DEFAULT_MAP_MEAL_PLAN = {
  key: 'map',
  label: 'MAP — Breakfast + Dinner',
  price: 0,
  absolutePrice: 0,
  meals: ['breakfast', 'dinner'],
};

const MEAL_PLAN_META = {
  ep: { key: 'ep', label: 'EP (Room Only)', meals: [] },
  cp: { key: 'cp', label: 'CP — Breakfast', meals: ['breakfast'] },
  map: { key: 'map', label: 'MAP — Breakfast + Dinner', meals: ['breakfast', 'dinner'] },
  ap: { key: 'ap', label: 'AP — All Meals', meals: ['breakfast', 'lunch', 'dinner'] },
  ai: { key: 'ai', label: 'AI (All inclusive)', meals: ['breakfast', 'lunch', 'dinner'] },
};

const FALLBACK_MEAL_PLANS = [
  { ...MEAL_PLAN_META.ep, price: 0, absolutePrice: 0 },
  { ...MEAL_PLAN_META.cp, price: 0, absolutePrice: 0 },
  { ...DEFAULT_MAP_MEAL_PLAN },
  { ...MEAL_PLAN_META.ap, price: 0, absolutePrice: 0 },
];

/** Normalize API codes / labels → ep|cp|map|ap|ai. */
export function normalizeMealPlanKey(codeOrLabel = '') {
  const s = String(codeOrLabel || '').trim().toLowerCase();
  if (!s) return '';
  if (s === 'ep' || s.startsWith('ep ') || s.startsWith('ep(') || /\bep\b/.test(s) || s.includes('room only')) {
    return 'ep';
  }
  if (s === 'cp' || s.startsWith('cp ') || s.startsWith('cp(') || /\bcp\b/.test(s)) return 'cp';
  if (s === 'map' || s.startsWith('map ') || s.startsWith('map(') || /\bmap\b/.test(s)) return 'map';
  if (s === 'ap' || s.startsWith('ap ') || s.startsWith('ap(') || /\bap\b/.test(s)) return 'ap';
  if (s === 'ai' || /\ball\s*inclusive\b/.test(s)) return 'ai';
  return '';
}

export function mealPlanFromCode(codeOrLabel = '', fallback = DEFAULT_MEAL_PLAN_KEY) {
  const key = normalizeMealPlanKey(codeOrLabel) || fallback;
  const meta = MEAL_PLAN_META[key] || MEAL_PLAN_META.map;
  return { ...meta, price: 0, absolutePrice: 0 };
}

export function isMapMealPlan(plan = {}) {
  return normalizeMealPlanKey(plan?.key || plan?.label) === 'map';
}

/** Nightly rate for a meal plan — website room.rates win (same as hotel picker). */
export function mealPlanNightlyRate(plan = {}, room = {}) {
  const key = normalizeMealPlanKey(plan?.key || plan?.label);
  const rates = room?.rates || {};
  const fromRates = key ? Number(rates[key] || 0) : 0;
  if (fromRates > 0) return fromRates;

  const absolute = Number(plan?.absolutePrice || 0);
  const supplement = Number(plan?.price || 0);
  const roomBase =
    Number(room?.epPrice || 0) ||
    Number(room?.rates?.ep || 0) ||
    Number(room?.pricePerNight || 0) ||
    0;

  // Stale plan row: absolute duplicated EP while supplement is the meal premium — use rates if present.
  if (absolute > 0 && supplement > 0 && roomBase > 0 && Math.abs(absolute - roomBase) < 1) {
    const rebuilt = Number(rates[key || 'map'] || 0);
    if (rebuilt > 0) return rebuilt;
    return Math.round((roomBase + supplement) * 100) / 100;
  }
  if (absolute > 0) return absolute;
  return Math.round((roomBase + supplement) * 100) / 100;
}

function preferPricedPlan(matches = [], room = null) {
  if (!matches.length) return null;
  return [...matches].sort(
    (a, b) => mealPlanNightlyRate(b, room || {}) - mealPlanNightlyRate(a, room || {})
  )[0];
}

/**
 * Prefer API meal options; ensure common plans exist. Fills absolutes from room.rates.
 */
export function ensureMealPlanOptions(room = {}) {
  const raw =
    Array.isArray(room?.mealPlanOptions) && room.mealPlanOptions.length
      ? room.mealPlanOptions.map((p) => ({ ...p }))
      : FALLBACK_MEAL_PLANS.map((p) => ({ ...p }));

  const rates = room?.rates || {};
  const ep = Number(rates.ep || room.epPrice || room.pricePerNight || 0);
  const enrich = (plan) => {
    const key = normalizeMealPlanKey(plan?.key || plan?.label);
    const fromRates = key ? Number(rates[key] || 0) : 0;
    if (fromRates > 0 && !(Number(plan.absolutePrice) > 0)) {
      return {
        ...plan,
        key: key || plan.key,
        absolutePrice: fromRates,
        price: ep > 0 ? Math.max(0, fromRates - ep) : Number(plan.price || 0),
      };
    }
    if (!(Number(plan.absolutePrice) > 0) && ep > 0 && Number(plan.price || 0) > 0) {
      return {
        ...plan,
        key: key || plan.key,
        absolutePrice: ep + Number(plan.price || 0),
      };
    }
    return key && !plan.key ? { ...plan, key } : plan;
  };

  const plans = raw.map(enrich);
  const hasMap = plans.some(isMapMealPlan);
  if (!hasMap) {
    const mapAbs = Number(rates.map || 0);
    const mapPlan =
      mapAbs > 0
        ? {
            ...DEFAULT_MAP_MEAL_PLAN,
            absolutePrice: mapAbs,
            price: ep > 0 ? Math.max(0, mapAbs - ep) : 0,
          }
        : { ...DEFAULT_MAP_MEAL_PLAN };
    plans.splice(Math.min(2, plans.length), 0, mapPlan);
  } else {
    const idx = plans.findIndex(isMapMealPlan);
    if (idx >= 0) plans[idx] = enrich(plans[idx]);
  }

  return plans;
}

/** Prefer package day's meal plan (MAP / EP / …); fall back to priced MAP. */
export function pickPreferredMealPlan(mealPlanOptions = [], room = null, preferredKey = DEFAULT_MEAL_PLAN_KEY) {
  const plans = Array.isArray(mealPlanOptions) && mealPlanOptions.length
    ? mealPlanOptions
    : ensureMealPlanOptions(room || {});
  const want = normalizeMealPlanKey(preferredKey) || DEFAULT_MEAL_PLAN_KEY;
  const matches = plans.filter((p) => normalizeMealPlanKey(p?.key || p?.label) === want);
  const preferred = preferPricedPlan(matches, room);
  if (preferred) return preferred;
  const mapPreferred = preferPricedPlan(plans.filter(isMapMealPlan), room);
  if (mapPreferred) return mapPreferred;
  const ensured = ensureMealPlanOptions(room || { mealPlanOptions: plans });
  return preferPricedPlan(ensured.filter(isMapMealPlan), room) || { ...DEFAULT_MAP_MEAL_PLAN };
}

/**
 * Prefer MAP from room mealPlanOptions; fall back to a synthetic MAP plan.
 */
export function pickDefaultMapMealPlan(mealPlanOptions = [], room = null) {
  return pickPreferredMealPlan(mealPlanOptions, room, 'map');
}

/** Re-bind a selected plan to the priced entry from the current options list. */
export function resolveSelectedMealPlan(
  selectedPlan,
  mealPlanOptions = [],
  room = null,
  preferredKey = DEFAULT_MEAL_PLAN_KEY
) {
  const plans = Array.isArray(mealPlanOptions) && mealPlanOptions.length
    ? mealPlanOptions
    : ensureMealPlanOptions(room || {});
  if (selectedPlan) {
    const key = normalizeMealPlanKey(selectedPlan.key || selectedPlan.label);
    if (key) {
      const matches = plans.filter((p) => normalizeMealPlanKey(p?.key || p?.label) === key);
      const priced = preferPricedPlan(matches, room);
      if (priced) return priced;
    }
    const byLabel = plans.filter(
      (p) =>
        String(p?.label || '').toLowerCase() === String(selectedPlan.label || '').toLowerCase()
    );
    const pricedLabel = preferPricedPlan(byLabel, room);
    if (pricedLabel) return pricedLabel;
  }
  return pickPreferredMealPlan(plans, room, preferredKey);
}

/** Package default room: stay tier id/name, then Deluxe, then first room. */
export function pickDefaultPackageRoom(rooms = [], hints = {}) {
  const list = Array.isArray(rooms) ? rooms : [];
  if (!list.length) return null;
  const roomId = hints.roomTypeId || hints.roomId || null;
  const roomName = String(
    hints.tierName || hints.roomName || hints.defaultRoomTypeName || ''
  )
    .trim()
    .toLowerCase();
  if (roomId) {
    const byId = list.find((r) => String(r.id || r._id) === String(roomId));
    if (byId) return byId;
  }
  if (roomName) {
    const exact = list.find((r) => String(r.name || '').trim().toLowerCase() === roomName);
    if (exact) return exact;
    const partial = list.find((r) => {
      const n = String(r.name || '').toLowerCase();
      return n.includes(roomName) || roomName.includes(n);
    });
    if (partial) return partial;
  }
  const deluxe = list.find((r) => /\bdeluxe\b/i.test(String(r.name || '')));
  if (deluxe) return deluxe;
  return list[0] || null;
}

/** Nightly rack for package default room + meal (MAP by default). */
export function defaultPackageRoomNightly(room = null, mealKey = DEFAULT_MEAL_PLAN_KEY) {
  if (!room) return 0;
  const want = normalizeMealPlanKey(mealKey) || DEFAULT_MEAL_PLAN_KEY;
  const fromRates = Number(room?.rates?.[want] || 0);
  if (fromRates > 0) return fromRates;
  const plans = ensureMealPlanOptions(room);
  const plan = pickPreferredMealPlan(plans, room, want);
  return mealPlanNightlyRate(plan, room);
}

/** Same rate logic as PackageResourcePickerDrawer — for day cards & seed. */
export function resolveHotelNightDisplayRate(hotelSel = null, meta = null, mealKey = 'map') {
  const room = hotelSel?.room || meta?.room || {};
  const want =
    normalizeMealPlanKey(
      hotelSel?.mealPlan?.key ||
        meta?.mealPlan?.key ||
        meta?.mealPlanKey ||
        hotelSel?.meals ||
        meta?.meals ||
        mealKey
    ) || 'map';
  const fromRates = Number(room?.rates?.[want] || 0);
  if (fromRates > 0) return fromRates;
  const plans = ensureMealPlanOptions(room);
  const selected = hotelSel?.mealPlan || meta?.mealPlan || null;
  const plan =
    resolveSelectedMealPlan(selected, plans, room, want) ||
    pickPreferredMealPlan(plans, room, want);
  const rate = mealPlanNightlyRate(plan, room);
  if (rate > 0) return rate;
  return (
    Number(hotelSel?.absolutePerNight ?? meta?.absolutePerNight ?? meta?.includedRate ?? 0) || 0
  );
}

const EXTRA_BED_FALLBACK_KEYS = ['map', 'cp', 'ep', 'ap'];

/** Website extra-bed / extra-mattress rates (same shape as room.rates). */
export function extraBedRatesFrom(source = {}) {
  const room = source?.room && typeof source.room === 'object' ? source.room : source;
  const raw =
    room?.extraBedRates ||
    source?.extraBedRates ||
    room?.extra_bed ||
    source?.extra_bed ||
    room?.rates?.extra_bed ||
    null;
  if (!raw || typeof raw !== 'object') return null;
  const ep = Number(raw.ep || 0) || 0;
  const cp = Number(raw.cp || 0) || 0;
  const map = Number(raw.map || 0) || 0;
  const ap = Number(raw.ap || 0) || 0;
  if (!ep && !cp && !map && !ap) return null;
  return { ep, cp, map, ap };
}

/**
 * Extra mattress nightly rate from hotel API extra_bed, matched to the selected meal plan.
 * Does not invent a % of room rack — 0 when the API has no extra-bed rate.
 */
export function resolveExtraBedNightRate(source = {}, mealKey = 'map') {
  const room = source?.room && typeof source.room === 'object' ? source.room : source;
  const want =
    normalizeMealPlanKey(
      mealKey ||
        source?.mealPlan?.key ||
        source?.mealPlanKey ||
        room?.mealPlanKey ||
        source?.meals
    ) || 'map';
  const rates = extraBedRatesFrom(source) || extraBedRatesFrom(room);
  if (rates) {
    const keyed = Number(rates[want] || 0);
    if (keyed > 0) return keyed;
    for (const key of EXTRA_BED_FALLBACK_KEYS) {
      if (Number(rates[key] || 0) > 0) return Number(rates[key]);
    }
  }
  return (
    Number(
      source?.extraBedPerNight ??
        room?.extraBedRate ??
        source?.mealPlan?.extraBed ??
        0
    ) || 0
  );
}
