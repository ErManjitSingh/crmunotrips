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

/** Nightly rate for a meal plan (absolute rack, else EP room + supplement). */
export function mealPlanNightlyRate(plan = {}, room = {}) {
  const absolute = Number(plan?.absolutePrice || 0);
  if (absolute > 0) return absolute;
  const roomBase =
    Number(room?.pricePerNight || 0) ||
    Number(room?.epPrice || 0) ||
    Number(room?.rates?.ep || 0) ||
    0;
  return Math.round((roomBase + Number(plan?.price || 0)) * 100) / 100;
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
  if (matches.length) {
    return [...matches].sort(
      (a, b) => mealPlanNightlyRate(b, room || {}) - mealPlanNightlyRate(a, room || {})
    )[0];
  }
  const mapMatches = plans.filter(isMapMealPlan);
  if (mapMatches.length) {
    return [...mapMatches].sort(
      (a, b) => mealPlanNightlyRate(b, room || {}) - mealPlanNightlyRate(a, room || {})
    )[0];
  }
  const ensured = ensureMealPlanOptions(room || { mealPlanOptions: plans });
  return ensured.find(isMapMealPlan) || { ...DEFAULT_MAP_MEAL_PLAN };
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
    const byKey = key
      ? plans.find((p) => normalizeMealPlanKey(p?.key || p?.label) === key)
      : null;
    if (byKey) return byKey;
    const byLabel = plans.find(
      (p) =>
        String(p?.label || '').toLowerCase() === String(selectedPlan.label || '').toLowerCase()
    );
    if (byLabel) return byLabel;
  }
  return pickPreferredMealPlan(plans, room, preferredKey);
}
