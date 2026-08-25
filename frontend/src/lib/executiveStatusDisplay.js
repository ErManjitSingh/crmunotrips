import { getLeadStatusLabel } from './leadStatusLabel';
import { LEAD_FOLLOW_UP_OUTCOMES } from '../constants/leadFollowUpOutcomes';
import {
  getAllOptionEntries,
  bucketFromOptionKey,
} from './leadStatusOptionsStore';

function currentOptionLabels() {
  return [...getAllOptionEntries(), ...LEAD_FOLLOW_UP_OUTCOMES];
}

function optionKeysByLength() {
  return currentOptionLabels()
    .map((o) => o.value)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
}

/** Internal markers for Cold → Warm (not user-picked Warm options). */
const COLD_TO_WARM_REASON_KEYS = new Set([
  'working_progress',
  'auto_connected_24h',
  'cold_to_warm',
]);

const COLD_TO_WARM_LABEL = 'Cold to Warm';
const WORKING_IN_PROGRESS_LABEL = 'Working in Progress';

function isSystemReasonKey(key) {
  return !key || COLD_TO_WARM_REASON_KEYS.has(String(key).trim());
}

function isColdToWarmLead(lead, reasonKey = '') {
  const status = String(lead?.status || '').trim();
  if (status === 'working_progress') return true;
  const raw = String(lead?.statusReason || '')
    .trim()
    .split(/\s*[—–]\s*|\s+-\s+/)[0]
    ?.replace(/:$/, '')
    .trim();
  return COLD_TO_WARM_REASON_KEYS.has(raw) || COLD_TO_WARM_REASON_KEYS.has(String(reasonKey || '').trim());
}

function extractReasonKey(statusReason) {
  const raw = String(statusReason || '').trim();
  if (!raw) return '';
  const cleaned = raw.replace(/^not_connected:/i, '').trim();
  const parts = cleaned.split(/\s*[—–]\s*|\s+-\s+/).map((p) => p.trim()).filter(Boolean);
  const head = (parts[0] || '').replace(/:$/, '').trim();
  const keys = optionKeysByLength();
  if (keys.includes(head)) return head;
  const found = keys.find(
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
  const hit = currentOptionLabels().find((o) => o.value === key || o.lostReason === key);
  if (hit?.label) return hit.label;
  // Also match when statusReason stored the human label instead of key
  const byLabel = currentOptionLabels().find(
    (o) => String(o.label || '').toLowerCase() === String(key).toLowerCase()
  );
  return byLabel?.label || '';
}

function resolveListReasonKey(lead) {
  const reason = String(lead?.statusReason || '').trim();
  const coldReason = String(lead?.coldReason || '').trim();
  const followUpOutcome = String(lead?.lastFollowUpOutcome || lead?.followUpOutcome || '').trim();
  const candidates = [
    extractReasonKey(reason),
    extractReasonKey(coldReason),
    extractReasonKey(followUpOutcome),
  ].filter((key) => key && !isSystemReasonKey(key));
  if (candidates.length) return candidates[0];
  // Match full reason / outcome against option labels (older free-text saves)
  const rawSources = [reason, coldReason, followUpOutcome].filter(
    (raw) => raw && !isSystemReasonKey(raw.split(/\s*[—–]\s*|\s+-\s+/)[0]?.trim())
  );
  const raw = rawSources[0] || '';
  if (!raw) return '';
  const head = raw.split(/\s*[—–]\s*|\s+-\s+/)[0]?.replace(/:$/, '').trim() || '';
  if (!head || isSystemReasonKey(head)) return '';
  const byLabel = currentOptionLabels().find(
    (o) => String(o.label || '').toLowerCase() === head.toLowerCase()
  );
  if (byLabel?.value) return byLabel.value;
  // Only keep legacy keys that map to a Warm/Hot/Cold bucket (e.g. cnp)
  if (bucketFromOptionKey(head) || /^cnp$/i.test(head)) return head;
  return '';
}

function bucketFromReasonKey(reasonKey) {
  return bucketFromOptionKey(reasonKey);
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
      label: 'Converted',
      detail: '',
      pipelineLabel,
      title: 'Converted',
      bucket: 'converted',
    };
  }

  if (optionLabel && bucket) {
    return {
      label: optionLabel,
      detail: '',
      pipelineLabel,
      title: isColdToWarmLead(lead, reasonKey)
        ? `${WORKING_IN_PROGRESS_LABEL} · ${COLD_TO_WARM_LABEL} · ${optionLabel}`
        : `${optionLabel} · ${bucket.charAt(0).toUpperCase()}${bucket.slice(1)}`,
      bucket,
      subLabel: isColdToWarmLead(lead, reasonKey) ? COLD_TO_WARM_LABEL : '',
    };
  }

  if (isColdToWarmLead(lead, reasonKey)) {
    return {
      label: WORKING_IN_PROGRESS_LABEL,
      detail: '',
      pipelineLabel,
      title: `${WORKING_IN_PROGRESS_LABEL} · ${COLD_TO_WARM_LABEL}`,
      bucket: 'warm',
      subLabel: COLD_TO_WARM_LABEL,
    };
  }

  return {
    label: 'No status',
    detail: '',
    pipelineLabel,
    title: 'No status',
    bucket: 'new',
    subLabel: '',
  };
}

/** Lead-list buckets only. */
export const LIST_STATUS_STYLES = {
  cold: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 ring-slate-500/25',
  warm: 'bg-amber-500/10 text-amber-800 dark:text-amber-300 ring-amber-500/25',
  hot: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 ring-rose-500/25',
  new: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 ring-sky-500/25',
  converted: 'bg-emerald-600/10 text-emerald-800 dark:text-emerald-300 ring-emerald-600/25',
  working: 'bg-orange-500/10 text-orange-800 dark:text-orange-300 ring-orange-500/25',
};

const LIST_STATUS_DOT = {
  cold: 'bg-slate-500',
  warm: 'bg-amber-500',
  hot: 'bg-rose-500',
  new: 'bg-sky-500',
  converted: 'bg-emerald-600',
  working: 'bg-orange-500',
};

function humanizeReasonKey(key) {
  if (!key) return '';
  const known = findOptionLabel(key);
  if (known) return known;
  const raw = String(key).trim();
  if (!raw || isSystemReasonKey(raw)) return '';
  if (/^cnp$/i.test(raw)) return 'CNP';
  return raw
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Status display for leads.
 * - Only Warm / Hot / Cold when user picked an option (temperature alone ≠ status)
 * - Cold→Warm pipeline → Working in Progress + Cold to Warm subtitle
 * - Otherwise → No status
 */
export function getLeadListStatusDisplay(lead) {
  const status = lead?.status || 'new';
  const reasonKey = resolveListReasonKey(lead);
  const fromReason = bucketFromReasonKey(reasonKey);
  const knownOption = findOptionLabel(reasonKey);
  // Only treat as a real selected status when it maps to a known Warm/Hot/Cold option
  const optionLabel =
    knownOption ||
    (fromReason ? humanizeReasonKey(reasonKey) : '') ||
    (/^cnp$/i.test(reasonKey) ? 'CNP' : '');
  const coldToWarm = isColdToWarmLead(lead, reasonKey);

  let bucket = 'new';
  if (status === 'converted') {
    bucket = 'converted';
  } else if (fromReason) {
    bucket = fromReason;
  } else if (coldToWarm) {
    bucket = 'warm';
  } else {
    bucket = 'new';
  }

  const categoryLabels = {
    cold: 'Cold',
    warm: 'Warm',
    hot: 'Hot',
    new: 'No status',
    converted: 'Converted',
  };

  const categoryLabel = categoryLabels[bucket] || 'No status';

  // No user option and not converted / Cold→Warm → No status (ignore bare temperature)
  const hasRealStatus = status === 'converted' || Boolean(optionLabel) || coldToWarm;

  const mainLabel = !hasRealStatus
    ? 'No status'
    : bucket === 'converted'
      ? 'Converted'
      : coldToWarm
        ? WORKING_IN_PROGRESS_LABEL
        : bucket === 'hot'
          ? 'Hot'
          : bucket === 'cold'
            ? 'Cold'
            : bucket === 'warm'
              ? 'Warm'
              : 'No status';

  const listBucket = !hasRealStatus ? 'new' : coldToWarm ? 'working' : bucket;
  const subLabel = hasRealStatus && coldToWarm ? COLD_TO_WARM_LABEL : '';

  let label = 'No status';
  if (bucket === 'converted') {
    label = 'Converted';
  } else if (optionLabel) {
    label = optionLabel;
  } else if (coldToWarm) {
    label = WORKING_IN_PROGRESS_LABEL;
  }

  return {
    bucket: hasRealStatus ? bucket : 'new',
    listBucket,
    label: hasRealStatus ? label : 'No status',
    mainLabel,
    subLabel,
    categoryLabel: hasRealStatus ? categoryLabel : 'No status',
    exactLabel: hasRealStatus ? optionLabel || label : 'No status',
    pipelineLabel: hasRealStatus ? categoryLabel : 'No status',
    detail: '',
    title: !hasRealStatus
      ? 'No status'
      : coldToWarm
        ? optionLabel
          ? `${WORKING_IN_PROGRESS_LABEL} · ${COLD_TO_WARM_LABEL} · ${optionLabel}`
          : `${WORKING_IN_PROGRESS_LABEL} · ${COLD_TO_WARM_LABEL}`
        : optionLabel && categoryLabel !== optionLabel && bucket !== 'new' && bucket !== 'converted'
          ? `${categoryLabel} · ${optionLabel}`
          : label,
    className: LIST_STATUS_STYLES[hasRealStatus ? bucket : 'new'] || LIST_STATUS_STYLES.new,
    listClassName: LIST_STATUS_STYLES[listBucket] || LIST_STATUS_STYLES.new,
    dotClass: LIST_STATUS_DOT[hasRealStatus ? bucket : 'new'] || LIST_STATUS_DOT.new,
    listDotClass: LIST_STATUS_DOT[listBucket] || LIST_STATUS_DOT.new,
    animateLabel: hasRealStatus && bucket === 'hot',
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
