/** Default meal plan for all package / hotel room selections. */
export const DEFAULT_MEAL_PLAN_KEY = 'map';

export const DEFAULT_MAP_MEAL_PLAN = {
  key: 'map',
  label: 'MAP — Breakfast + Dinner',
  price: 0,
  absolutePrice: 0,
  meals: ['breakfast', 'dinner'],
};

const FALLBACK_MEAL_PLANS = [
  { key: 'ep', label: 'EP (Room Only)', price: 0, absolutePrice: 0, meals: [] },
  { key: 'cp', label: 'CP — Breakfast', price: 0, absolutePrice: 0, meals: ['breakfast'] },
  { ...DEFAULT_MAP_MEAL_PLAN },
  { key: 'ap', label: 'AP — All Meals', price: 0, absolutePrice: 0, meals: ['breakfast', 'lunch', 'dinner'] },
];

export function isMapMealPlan(plan = {}) {
  const key = String(plan?.key || '').toLowerCase();
  if (key === 'map') return true;
  return /\bmap\b/i.test(String(plan?.label || ''));
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
 * Prefer API meal options; always ensure MAP is present so SE lands on MAP
 * and can switch to EP/CP/AP. Fills MAP absolute from room.rates when missing.
 */
export function ensureMealPlanOptions(room = {}) {
  const raw =
    Array.isArray(room?.mealPlanOptions) && room.mealPlanOptions.length
      ? room.mealPlanOptions.map((p) => ({ ...p }))
      : FALLBACK_MEAL_PLANS.map((p) => ({ ...p }));

  const rates = room?.rates || {};
  const ep = Number(rates.ep || room.epPrice || room.pricePerNight || 0);
  const enrich = (plan) => {
    const key = String(plan?.key || '').toLowerCase();
    const fromRates = Number(rates[key] || 0);
    if (fromRates > 0 && !(Number(plan.absolutePrice) > 0)) {
      return {
        ...plan,
        absolutePrice: fromRates,
        price: ep > 0 ? Math.max(0, fromRates - ep) : Number(plan.price || 0),
      };
    }
    return plan;
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
    // If MAP exists but has no price, try rates.map
    const idx = plans.findIndex(isMapMealPlan);
    if (idx >= 0) plans[idx] = enrich(plans[idx]);
  }

  return plans;
}

/**
 * Prefer MAP from room mealPlanOptions; fall back to a synthetic MAP plan
 * so SE always lands on MAP and can switch to EP/CP/AP if needed.
 */
export function pickDefaultMapMealPlan(mealPlanOptions = [], room = null) {
  const plans = Array.isArray(mealPlanOptions) && mealPlanOptions.length
    ? mealPlanOptions
    : ensureMealPlanOptions(room || {});
  const byKey = plans.find((p) => String(p?.key || '').toLowerCase() === DEFAULT_MEAL_PLAN_KEY);
  if (byKey) return byKey;
  const byLabel = plans.find((p) => /\bmap\b/i.test(String(p?.label || '')));
  if (byLabel) return byLabel;
  return { ...DEFAULT_MAP_MEAL_PLAN };
}
