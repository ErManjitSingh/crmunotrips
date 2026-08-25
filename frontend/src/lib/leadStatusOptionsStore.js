/**
 * Runtime Warm / Hot / Cold options (admin-configurable).
 * Converted is a fixed main status (not admin-edited).
 * Falls back to static defaults until API loads.
 */
import {
  DEFAULT_WARM_OUTCOMES,
  DEFAULT_HOT_OUTCOMES,
  DEFAULT_COLD_OUTCOMES,
  DEFAULT_CONVERTED_OUTCOMES,
} from './leadStatusDefaults';

let listeners = new Set();
let state = {
  warm: DEFAULT_WARM_OUTCOMES.map((o) => ({ ...o })),
  hot: DEFAULT_HOT_OUTCOMES.map((o) => ({ ...o })),
  cold: DEFAULT_COLD_OUTCOMES.map((o) => ({ ...o })),
  loaded: false,
};

function notify() {
  listeners.forEach((fn) => {
    try {
      fn(state);
    } catch {
      /* ignore */
    }
  });
}

function toUiList(arr) {
  return (arr || [])
    .filter((o) => o && o.enabled !== false)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((o) => ({
      value: o.key || o.value,
      label: o.label,
      key: o.key || o.value,
      enabled: o.enabled !== false,
      sortOrder: o.sortOrder ?? 0,
    }));
}

export function getLeadStatusOptionsState() {
  return state;
}

export function getWarmOutcomes() {
  return state.warm.length ? state.warm : DEFAULT_WARM_OUTCOMES;
}

export function getHotOutcomes() {
  return state.hot.length ? state.hot : DEFAULT_HOT_OUTCOMES;
}

export function getColdOutcomes() {
  return state.cold.length ? state.cold : DEFAULT_COLD_OUTCOMES;
}

export function getConvertedOutcomes() {
  return DEFAULT_CONVERTED_OUTCOMES.map((o) => ({ ...o }));
}

export function getOutcomesForCategoryDynamic(category) {
  if (category === 'hot') return getHotOutcomes();
  if (category === 'cold') return getColdOutcomes();
  if (category === 'converted') return getConvertedOutcomes();
  return getWarmOutcomes();
}

export function setLeadStatusOptionsFromApi(data) {
  state = {
    warm: toUiList(data?.warm),
    hot: toUiList(data?.hot),
    cold: toUiList(data?.cold),
    loaded: true,
  };
  if (!state.warm.length) state.warm = DEFAULT_WARM_OUTCOMES.map((o) => ({ ...o }));
  if (!state.hot.length) state.hot = DEFAULT_HOT_OUTCOMES.map((o) => ({ ...o }));
  if (!state.cold.length) state.cold = DEFAULT_COLD_OUTCOMES.map((o) => ({ ...o }));
  notify();
  return state;
}

export function subscribeLeadStatusOptions(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getAllOptionEntries() {
  return [
    ...getWarmOutcomes().map((o) => ({ ...o, category: 'warm' })),
    ...getHotOutcomes().map((o) => ({ ...o, category: 'hot' })),
    ...getColdOutcomes().map((o) => ({ ...o, category: 'cold' })),
    ...getConvertedOutcomes().map((o) => ({ ...o, category: 'converted' })),
    { value: 'budget_issue', label: 'Budget issues', category: 'cold' },
  ];
}

export function bucketFromOptionKey(key) {
  if (!key) return '';
  if (key === 'converted' || getConvertedOutcomes().some((o) => o.value === key)) return 'converted';
  if (getHotOutcomes().some((o) => o.value === key)) return 'hot';
  if (getWarmOutcomes().some((o) => o.value === key)) return 'warm';
  if (getColdOutcomes().some((o) => o.value === key) || key === 'budget_issue') return 'cold';
  return '';
}
