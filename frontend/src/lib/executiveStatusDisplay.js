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
  const fromReason =
    extractReasonKey(reason) ||
    extractReasonKey(coldReason) ||
    extractReasonKey(followUpOutcome);
  if (fromReason) return fromReason;
  // Match full reason / outcome against option labels (older free-text saves)
  const raw = reason || coldReason || followUpOutcome;
  if (!raw) return '';
  const head = raw.split(/\s*[—–]\s*|\s+-\s+/)[0]?.replace(/:$/, '').trim() || '';
  if (!head) return '';
  const byLabel = currentOptionLabels().find(
    (o) => String(o.label || '').toLowerCase() === head.toLowerCase()
  );
  if (byLabel?.value) return byLabel.value;
  // Legacy keys (e.g. cnp) still count as the selected status
  return head;
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

  if (status === 'working_progress' || reasonKey === 'working_progress') {
    return {
      label: 'Working Progress',
      detail: '',
      pipelineLabel,
      title: 'Working Progress',
      bucket: 'working',
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
  if (!raw || raw === 'working_progress') return '';
  if (/^cnp$/i.test(raw)) return 'CNP';
  return raw
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Status display for leads.
 * - mainLabel: list-only Warm / Hot / Cold / Converted / No status
 * - label / exactLabel: selected option for lead open / modal
 */
export function getLeadListStatusDisplay(lead) {
  const status = lead?.status || 'new';
  const reasonKey = resolveListReasonKey(lead);
  const optionLabel = findOptionLabel(reasonKey) || humanizeReasonKey(reasonKey);
  const temperature = String(lead?.temperature || '').toLowerCase();

  let bucket = 'new';
  if (status === 'converted') {
    bucket = 'converted';
  } else if (
    status === 'working_progress' ||
    reasonKey === 'working_progress'
  ) {
    bucket = 'working';
  } else {
    const fromReason = bucketFromReasonKey(reasonKey);
    if (fromReason) {
      bucket = fromReason;
    } else if (['warm', 'hot', 'cold'].includes(temperature)) {
      // Temperature set (even without option) — used for list main status color/label
      bucket = temperature;
    } else {
      bucket = 'new';
    }
  }

  const categoryLabels = {
    cold: 'Cold',
    warm: 'Warm',
    hot: 'Hot',
    new: 'No status',
    converted: 'Converted',
    working: 'Working Progress',
  };

  const categoryLabel = categoryLabels[bucket] || 'No status';

  // List column: only main statuses
  const mainLabel =
    bucket === 'converted'
      ? 'Converted'
      : bucket === 'hot'
        ? 'Hot'
        : bucket === 'cold'
          ? 'Cold'
          : bucket === 'warm' || bucket === 'working'
            ? 'Warm'
            : 'No status';

  const listBucket = bucket === 'working' ? 'warm' : bucket;

  // Detail / modal: exact selected option when present
  let label = 'No status';
  if (bucket === 'converted') {
    label = 'Converted';
  } else if (bucket === 'working') {
    label = 'Working Progress';
  } else if (optionLabel) {
    label = optionLabel;
  }

  return {
    bucket,
    listBucket,
    label,
    mainLabel,
    categoryLabel,
    exactLabel: optionLabel || label,
    pipelineLabel: categoryLabel,
    detail: '',
    title:
      optionLabel && categoryLabel !== optionLabel && bucket !== 'new' && bucket !== 'converted' && bucket !== 'working'
        ? `${categoryLabel} · ${optionLabel}`
        : label,
    className: LIST_STATUS_STYLES[bucket] || LIST_STATUS_STYLES.new,
    listClassName: LIST_STATUS_STYLES[listBucket] || LIST_STATUS_STYLES.new,
    dotClass: LIST_STATUS_DOT[bucket] || LIST_STATUS_DOT.new,
    listDotClass: LIST_STATUS_DOT[listBucket] || LIST_STATUS_DOT.new,
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
