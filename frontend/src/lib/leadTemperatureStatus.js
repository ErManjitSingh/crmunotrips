/**
 * Canonical CRM lead status = Warm / Hot / Cold (+ Booking for converted).
 * Sub-options are the only selectable outcomes across the CRM.
 */
import {
  WARM_OUTCOMES,
  HOT_OUTCOMES,
  COLD_OUTCOMES,
  FOLLOWUP_CATEGORY_OPTIONS,
  getOutcomesForCategory,
} from '../components/followups/constants';

export { WARM_OUTCOMES, HOT_OUTCOMES, COLD_OUTCOMES, FOLLOWUP_CATEGORY_OPTIONS, getOutcomesForCategory };

/** Lead list / filter chips — Warm, Hot, Cold only */
export const LEAD_TEMPERATURE_FILTERS = [
  { value: 'cold', label: 'Cold' },
  { value: 'warm', label: 'Warm' },
  { value: 'hot', label: 'Hot' },
];

/** All selectable outcomes (for dropdowns that list every option) */
export const ALL_LEAD_STATUS_OUTCOMES = [
  ...WARM_OUTCOMES.map((o) => ({ ...o, category: 'warm', temperature: 'warm' })),
  ...HOT_OUTCOMES.map((o) => ({ ...o, category: 'hot', temperature: 'hot' })),
  ...COLD_OUTCOMES.map((o) => ({ ...o, category: 'cold', temperature: 'cold' })),
];

/**
 * Map Warm/Hot/Cold + option → API lead update payload.
 * Keeps pipeline `status` compatible with existing backend enum.
 */
export function buildLeadStatusPayload(category, option, comment = '') {
  const note = String(comment || '').trim();
  const statusReason = note ? `${option} — ${note}` : option;

  if (category === 'warm') {
    return {
      status: option === 'cnp_same_day' ? 'follow_up' : 'contacted',
      statusReason,
      temperature: 'warm',
      isHot: false,
    };
  }

  if (category === 'hot') {
    return {
      status: 'negotiation',
      statusReason,
      temperature: 'hot',
      isHot: true,
    };
  }

  if (category === 'cold') {
    return {
      status: 'follow_up',
      statusReason,
      temperature: 'cold',
      coldReason: option,
      isHot: false,
    };
  }

  return null;
}

/** Map raw pipeline status → display when no lead/statusReason is available. */
export function pipelineStatusToTemperatureLabel(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'converted') return 'Booking';
  if (s === 'warm') return 'Warm';
  if (s === 'hot') return 'Hot';
  if (s === 'cold') return 'Cold';
  return 'No status';
}
