import { getLeadStatusLabel } from './leadStatusLabel';
import { LEAD_FOLLOW_UP_OUTCOMES } from '../constants/leadFollowUpOutcomes';
import {
  WARM_OUTCOMES,
  HOT_OUTCOMES,
  COLD_OUTCOMES,
} from '../components/followups/constants';

/** Only the current Warm / Hot / Cold options count as a selected status */
const CURRENT_OPTIONS = [
  ...WARM_OUTCOMES,
  ...HOT_OUTCOMES,
  ...COLD_OUTCOMES,
  { value: 'budget_issue', label: 'Budget issues' }, // legacy alias → Cold
];

const OPTION_LABELS = [
  ...CURRENT_OPTIONS,
  ...LEAD_FOLLOW_UP_OUTCOMES,
];

const OPTION_KEYS_BY_LENGTH = [...OPTION_LABELS]
  .map((o) => o.value)
  .filter(Boolean)
  .sort((a, b) => b.length - a.length);

const WARM_REASON_KEYS = new Set(WARM_OUTCOMES.map((o) => o.value));
const HOT_REASON_KEYS = new Set(HOT_OUTCOMES.map((o) => o.value));
const COLD_REASON_KEYS = new Set([
  ...COLD_OUTCOMES.map((o) => o.value),
  'budget_issue',
]);

function extractReasonKey(statusReason) {
  const raw = String(statusReason || '').trim();
  if (!raw) return '';
  const cleaned = raw.replace(/^not_connected:/i, '').trim();
  const parts = cleaned.split(/\s*[—–]\s*|\s+-\s+/).map((p) => p.trim()).filter(Boolean);
  const head = (parts[0] || '').replace(/:$/, '').trim();
  if (OPTION_KEYS_BY_LENGTH.includes(head)) return head;
  const found = OPTION_KEYS_BY_LENGTH.find(
    (key) =>
      cleaned === key ||
      cleaned.startsWith(`${key} `) ||
      cleaned.startsWith(`${key}—`) ||
      cleaned.startsWith(`${key}–`) ||
      cleaned.startsWith(`${key}:`) ||
      cleaned.includes(` ${key} `) ||
      cleaned.endsWith(` ${key}`)
  );
  return found || '';
}

function findOptionLabel(key) {
  if (!key) return '';
  const hit = OPTION_LABELS.find((o) => o.value === key || o.lostReason === key);
  return hit?.label || '';
}

function resolveListReasonKey(lead) {
  const reason = String(lead?.statusReason || '').trim();
  const followUpOutcome = String(lead?.lastFollowUpOutcome || lead?.followUpOutcome || '').trim();
  return extractReasonKey(reason) || extractReasonKey(followUpOutcome);
}

function bucketFromReasonKey(reasonKey) {
  if (HOT_REASON_KEYS.has(reasonKey)) return 'hot';
  if (WARM_REASON_KEYS.has(reasonKey)) return 'warm';
  if (COLD_REASON_KEYS.has(reasonKey)) return 'cold';
  return '';
}

/**
 * Exact selected option label — or "No status" when none of the current options is set.
 */
export function getExecutiveSetStatusDisplay(lead) {
  const status = lead?.status || 'new';
  const pipelineLabel = getLeadStatusLabel(status);
  const reasonKey = resolveListReasonKey(lead);
  const optionLabel = findOptionLabel(reasonKey);
  const bucket = bucketFromReasonKey(reasonKey);

  if (status === 'converted') {
    return {
      label: 'Booking',
      detail: '',
      pipelineLabel,
      title: 'Booking',
      bucket: 'converted',
    };
  }

  if (optionLabel && bucket) {
    return {
      label: optionLabel,
      detail: '',
      pipelineLabel,
      title: `${optionLabel} · ${bucket.charAt(0).toUpperCase()}${bucket.slice(1)}`,
      bucket,
    };
  }

  return {
    label: 'No status',
    detail: '',
    pipelineLabel,
    title: 'No status',
    bucket: 'new',
  };
}

/** Lead-list buckets only. */
export const LIST_STATUS_STYLES = {
  cold: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 ring-slate-500/25',
  warm: 'bg-amber-500/10 text-amber-800 dark:text-amber-300 ring-amber-500/25',
  hot: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 ring-rose-500/25',
  new: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 ring-sky-500/25',
  converted: 'bg-emerald-600/10 text-emerald-800 dark:text-emerald-300 ring-emerald-600/25',
};

const LIST_STATUS_DOT = {
  cold: 'bg-slate-500',
  warm: 'bg-amber-500',
  hot: 'bg-rose-500',
  new: 'bg-sky-500',
  converted: 'bg-emerald-600',
};

/**
 * Lead list: Warm / Hot / Cold only when a current option is selected.
 * Otherwise → No status.
 */
export function getLeadListStatusDisplay(lead) {
  const status = lead?.status || 'new';
  const reasonKey = resolveListReasonKey(lead);
  const optionLabel = findOptionLabel(reasonKey);

  let bucket = 'new';
  if (status === 'converted') {
    bucket = 'converted';
  } else {
    const fromReason = bucketFromReasonKey(reasonKey);
    bucket = fromReason || 'new';
  }

  const labels = {
    cold: 'Cold',
    warm: 'Warm',
    hot: 'Hot',
    new: 'No status',
    converted: 'Booking',
  };

  const exactLabel =
    bucket === 'converted'
      ? 'Booking'
      : optionLabel && bucket !== 'new'
        ? optionLabel
        : 'No status';

  return {
    bucket,
    label: labels[bucket],
    exactLabel,
    pipelineLabel: labels[bucket],
    detail: '',
    title:
      bucket === 'new' || bucket === 'converted'
        ? labels[bucket]
        : `${labels[bucket]} · ${exactLabel}`,
    className: LIST_STATUS_STYLES[bucket] || LIST_STATUS_STYLES.new,
    dotClass: LIST_STATUS_DOT[bucket] || LIST_STATUS_DOT.new,
    animateLabel: bucket === 'hot',
  };
}

export function listStatusTextClass(display) {
  return display?.animateLabel ? 'inline-block origin-center animate-hot-text' : undefined;
}

export const LIST_STATUS_FILTERS = [
  {
    value: 'cold',
    label: 'Cold',
    activeClass: 'bg-slate-700 text-white shadow-sm shadow-slate-500/30 ring-slate-800/20',
    idleClass: 'bg-slate-100 text-slate-700 ring-slate-200 hover:bg-slate-200/80',
  },
  {
    value: 'warm',
    label: 'Warm',
    activeClass: 'bg-amber-500 text-white shadow-sm shadow-amber-500/30 ring-amber-600/20',
    idleClass: 'bg-amber-50 text-amber-800 ring-amber-200 hover:bg-amber-100',
  },
  {
    value: 'hot',
    label: 'Hot',
    activeClass: 'bg-rose-600 text-white shadow-sm shadow-rose-500/30 ring-rose-700/20',
    idleClass: 'bg-rose-50 text-rose-700 ring-rose-200 hover:bg-rose-100',
  },
];
