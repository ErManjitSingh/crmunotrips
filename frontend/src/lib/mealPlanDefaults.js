/** Default meal plan for all package / hotel room selections. */
export const DEFAULT_MEAL_PLAN_KEY = 'map';

export const DEFAULT_MAP_MEAL_PLAN = {
  key: 'map',
  label: 'MAP — Breakfast + Dinner',
  price: 0,
  absolutePrice: 0,
  meals: ['breakfast', 'dinner'],
};

/**
 * Prefer MAP from room mealPlanOptions; fall back to a synthetic MAP plan
 * so SE always lands on MAP and can switch to EP/CP/AP if needed.
 */
export function pickDefaultMapMealPlan(mealPlanOptions = []) {
  const plans = Array.isArray(mealPlanOptions) ? mealPlanOptions : [];
  const byKey = plans.find((p) => String(p?.key || '').toLowerCase() === DEFAULT_MEAL_PLAN_KEY);
  if (byKey) return byKey;
  const byLabel = plans.find((p) => /\bmap\b/i.test(String(p?.label || '')));
  if (byLabel) return byLabel;
  return { ...DEFAULT_MAP_MEAL_PLAN };
}

export function isMapMealPlan(plan = {}) {
  const key = String(plan?.key || '').toLowerCase();
  if (key === 'map') return true;
  return /\bmap\b/i.test(String(plan?.label || ''));
}
