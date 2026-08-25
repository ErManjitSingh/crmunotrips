/**
 * Canonical CRM lead status = Warm / Hot / Cold / Converted.
 * Sub-options are the only selectable outcomes across the CRM.
 */
import {
  WARM_OUTCOMES,
  HOT_OUTCOMES,
  COLD_OUTCOMES,
  CONVERTED_OUTCOMES,
  FOLLOWUP_CATEGORY_OPTIONS,
  getOutcomesForCategory,
} from '../components/followups/constants';
import { getColdOutcomes, bucketFromOptionKey } from './leadStatusOptionsStore';

export {
  WARM_OUTCOMES,
  HOT_OUTCOMES,
  COLD_OUTCOMES,
  CONVERTED_OUTCOMES,
  FOLLOWUP_CATEGORY_OPTIONS,
  getOutcomesForCategory,
};

/** Lead list / filter chips — Warm, Hot, Cold only (Converted has its own Bookings filter) */
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
  ...CONVERTED_OUTCOMES.map((o) => ({ ...o, category: 'converted', temperature: 'hot' })),
];

const COLD_OPTION_KEYS = new Set([
  ...COLD_OUTCOMES.map((o) => o.value),
  'budget_issue',
]);

function extractHeadReason(statusReason) {
  const raw = String(statusReason || '').trim();
  if (!raw) return '';
  return raw.split(/\s*[—–]\s*|\s+-\s+/)[0]?.replace(/:$/, '').trim() || '';
}

/** True when lead is currently Cold (temperature or cold option). */
export function isLeadCurrentlyCold(lead) {
  if (!lead) return false;
  if (String(lead.temperature || '').toLowerCase() === 'cold') return true;
  const reason = extractHeadReason(lead.statusReason);
  if (bucketFromOptionKey(reason) === 'cold') return true;
  if (lead.coldReason && bucketFromOptionKey(String(lead.coldReason)) === 'cold') return true;
  const coldKeys = new Set([...getColdOutcomes().map((o) => o.value), ...COLD_OPTION_KEYS]);
  if (coldKeys.has(reason)) return true;
  if (lead.coldReason && coldKeys.has(String(lead.coldReason))) return true;
  return false;
}

/**
 * Map Warm/Hot/Cold/Converted + option → API lead update payload.
 * Cold → Warm moves straight to Working Progress (no Cold/Warm badge on that move).
 * Converted requires payment screenshot + advanceAmount on the request (added by UI).
 */
export function buildLeadStatusPayload(category, option, comment = '', lead = null) {
  const note = String(comment || '').trim();
  const statusReason = note ? `${option} — ${note}` : option;

  if (category === 'warm') {
    const fromCold = isLeadCurrentlyCold(lead);
    if (fromCold) {
      return {
        status: 'working_progress',
        statusReason,
        temperature: 'warm',
        isHot: false,
        coldReason: '',
        fromColdToWarm: true,
        warmOption: option,
      };
    }
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

  if (category === 'converted') {
    return {
      status: 'converted',
      statusReason: note ? `converted — ${note}` : 'converted',
      temperature: 'hot',
      isHot: true,
      coldReason: '',
    };
  }

  return null;
}

/** Map raw pipeline status → display when no lead/statusReason is available. */
export function pipelineStatusToTemperatureLabel(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'converted') return 'Converted';
  if (s === 'working_progress') return 'Warm';
  if (s === 'warm') return 'Warm';
  if (s === 'hot') return 'Hot';
  if (s === 'cold') return 'Cold';
  return 'No status';
}
