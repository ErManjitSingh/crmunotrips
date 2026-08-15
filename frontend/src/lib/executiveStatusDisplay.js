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
 * Lead list should show the exact option the executive selected,
 * never a generic "Connected / Contacted" when a real option exists.
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
