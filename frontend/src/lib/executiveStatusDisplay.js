import { getLeadStatusLabel } from './leadStatusLabel';
import { LEAD_FOLLOW_UP_OUTCOMES } from '../constants/leadFollowUpOutcomes';
import { LOST_REASONS, formatLostReasonDisplay } from '../constants/salesSop';
import {
  CALL_PICKED_OUTCOMES,
  CALL_NOT_PICKED_REASONS,
  FOLLOWUP_COLD_REASONS,
} from '../components/followups/constants';

const OPTION_LABELS = [
  ...CALL_PICKED_OUTCOMES,
  ...CALL_NOT_PICKED_REASONS,
  ...FOLLOWUP_COLD_REASONS,
  ...LOST_REASONS,
  ...LEAD_FOLLOW_UP_OUTCOMES,
  // legacy aliases
  { value: 'switch_off', label: 'Switch off' },
  { value: 'switched_off', label: 'Switch off' },
  { value: 'no_answer', label: 'Not answer' },
  { value: 'not_answering', label: 'Not answer' },
];

/** Longest keys first so interested_quotation wins over interested */
const OPTION_KEYS_BY_LENGTH = [...OPTION_LABELS]
  .map((o) => o.value)
  .filter(Boolean)
  .sort((a, b) => b.length - a.length);

function extractReasonKey(statusReason) {
  const raw = String(statusReason || '').trim();
  if (!raw) return '';
  const cleaned = raw.replace(/^not_connected:/i, '').trim();
  const parts = cleaned.split(/\s*[—–]\s*|\s+-\s+/).map((p) => p.trim()).filter(Boolean);
  const head = (parts[0] || '').replace(/:$/, '').trim();
  if (OPTION_KEYS_BY_LENGTH.includes(head)) return head;
  // statusReason may be free text that still contains the option key
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
  return found || head;
}

function findOptionLabel(key) {
  if (!key) return '';
  const hit = OPTION_LABELS.find((o) => o.value === key || o.lostReason === key);
  return hit?.label || '';
}

/**
 * Exact executive option / pipeline label — used on lead detail, not the list.
 */
export function getExecutiveSetStatusDisplay(lead) {
  const status = lead?.status || 'new';
  const pipelineLabel = getLeadStatusLabel(status);
  const reason = String(lead?.statusReason || '').trim();
  const followUpOutcome = String(lead?.lastFollowUpOutcome || lead?.followUpOutcome || '').trim();
  const reasonKey = extractReasonKey(reason) || extractReasonKey(followUpOutcome);
  const optionLabel = findOptionLabel(reasonKey) || findOptionLabel(followUpOutcome);
  const lostComment = ['lost', 'booked_from_another_company'].includes(status)
    ? formatLostReasonDisplay(reason)
    : '';

  if (
    lead?.reactivation?.isReactivated &&
    ['follow_up', 'working_progress', 'contacted', 'negotiation', 'quotation_sent'].includes(status)
  ) {
    return {
      label: optionLabel || 'Active',
      detail: optionLabel ? 'Active' : '',
      pipelineLabel,
      title: optionLabel ? `${optionLabel} · Active` : 'Active',
    };
  }

  // Prefer the exact executive option over pipeline bucket labels
  if (optionLabel) {
    return {
      label: optionLabel,
      detail: '',
      pipelineLabel,
      title: `${optionLabel} · ${pipelineLabel}`,
    };
  }

  if (lostComment) {
    return {
      label: lostComment,
      detail: pipelineLabel,
      pipelineLabel,
      title: `${lostComment} · ${pipelineLabel}`,
    };
  }

  return {
    label: pipelineLabel,
    detail: '',
    pipelineLabel,
    title: pipelineLabel,
  };
}

/** Lead-list buckets only. Detail view still uses getExecutiveSetStatusDisplay. */
export const LIST_STATUS_STYLES = {
  cold: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 ring-slate-500/25',
  warm: 'bg-amber-500/10 text-amber-800 dark:text-amber-300 ring-amber-500/25',
  hot: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 ring-rose-500/25',
  lost: 'bg-red-500/10 text-red-700 dark:text-red-300 ring-red-500/25',
  new: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 ring-sky-500/25',
  converted: 'bg-emerald-600/10 text-emerald-800 dark:text-emerald-300 ring-emerald-600/25',
};

const LIST_STATUS_DOT = {
  cold: 'bg-slate-500',
  warm: 'bg-amber-500',
  hot: 'bg-rose-500',
  lost: 'bg-red-500',
  new: 'bg-sky-500',
  converted: 'bg-emerald-600',
};

const COLD_REASON_KEYS = new Set([
  'not_interested',
  'invalid_number',
  'switch_off',
  'switched_off',
  'not_reachable',
  'not_answer',
  'no_answer',
  'not_answering',
  'no_plan',
  'just_inquiring',
  'just_inquiry',
  'language_barrier',
  'wants_group_tour',
  'unknown_destination',
  'speaking_to_someone_else',
  'call_not_picked',
  'not_pick_call',
  'not_picked',
]);

const WARM_REASON_KEYS = new Set([
  'discussed_package',
  'budget_issues',
  'budget_issue',
  'qualified',
  'working_progress',
  'requested_callback',
  'rescheduled',
]);

const HOT_REASON_KEYS = new Set([
  'interested',
  'interested_quotation',
  'ready_to_book',
  'price_negotiation',
]);

const LOST_REASON_KEYS = new Set([
  'lost',
  'lost_contacted',
  'booked_elsewhere',
  'does_not_exist',
  'quotation_booked_elsewhere',
  'booked_from_another_company',
]);

function resolveListReasonKey(lead) {
  const reason = String(lead?.statusReason || '').trim();
  const followUpOutcome = String(lead?.lastFollowUpOutcome || lead?.followUpOutcome || '').trim();
  return extractReasonKey(reason) || extractReasonKey(followUpOutcome);
}

/**
 * Lead list shows only Cold / Warm / Hot / Lost lead.
 * Exact executive option remains available via exactLabel (and on lead detail).
 */
export function getLeadListStatusDisplay(lead) {
  const exact = getExecutiveSetStatusDisplay(lead);
  const status = lead?.status || 'new';
  const reasonKey = resolveListReasonKey(lead);

  let bucket;
  if (
    ['lost', 'booked_from_another_company'].includes(status) ||
    LOST_REASON_KEYS.has(reasonKey)
  ) {
    bucket = 'lost';
  } else if (HOT_REASON_KEYS.has(reasonKey) || status === 'negotiation') {
    bucket = 'hot';
  } else if (WARM_REASON_KEYS.has(reasonKey) || ['qualified', 'working_progress'].includes(status)) {
    bucket = 'warm';
  } else if (COLD_REASON_KEYS.has(reasonKey)) {
    bucket = 'cold';
  } else if (status === 'converted') {
    bucket = 'converted';
  } else if (status === 'new' && !reasonKey) {
    bucket = 'new';
  } else if (['quotation_sent'].includes(status)) {
    bucket = 'hot';
  } else if (['follow_up', 'contacted', 'reactivated'].includes(status) && !reasonKey) {
    bucket = 'warm';
  } else {
    bucket = 'cold';
  }

  const labels = {
    cold: 'Cold',
    warm: 'Warm',
    hot: 'Hot',
    lost: 'Lost lead',
    new: 'No status',
    converted: 'Booking',
  };

  return {
    bucket,
    label: labels[bucket],
    exactLabel: exact.label,
    pipelineLabel: exact.pipelineLabel,
    detail: '',
    title: `${labels[bucket]} · ${exact.label}`,
    className: LIST_STATUS_STYLES[bucket] || LIST_STATUS_STYLES.cold,
    dotClass: LIST_STATUS_DOT[bucket] || LIST_STATUS_DOT.cold,
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
  {
    value: 'lost',
    label: 'Lost lead',
    activeClass: 'bg-red-600 text-white shadow-sm shadow-red-500/30 ring-red-700/20',
    idleClass: 'bg-red-50 text-red-700 ring-red-200 hover:bg-red-100',
  },
];
