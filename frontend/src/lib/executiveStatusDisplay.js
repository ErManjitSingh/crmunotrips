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
  { value: 'no_answer', label: 'Not answer' },
];

function extractReasonKey(statusReason) {
  const raw = String(statusReason || '').trim();
  if (!raw) return '';
  // "interested_quotation — note" | "not_connected:switched_off — note" | bare key
  const cleaned = raw.replace(/^not_connected:/i, '').trim();
  const parts = cleaned.split(/\s*[—–]\s*|\s+-\s+|:/).map((p) => p.trim()).filter(Boolean);
  return parts[0] || '';
}

function findOptionLabel(key) {
  if (!key) return '';
  const hit = OPTION_LABELS.find((o) => o.value === key || o.lostReason === key);
  return hit?.label || '';
}

/**
 * Lead list should show the option the executive set on follow-up,
 * not only the generic pipeline bucket (New / Contacted / Follow-up).
 */
export function getExecutiveSetStatusDisplay(lead) {
  const status = lead?.status || 'new';
  const pipelineLabel = getLeadStatusLabel(status);
  const reason = String(lead?.statusReason || '').trim();
  const reasonKey = extractReasonKey(reason);
  const optionLabel = findOptionLabel(reasonKey);
  const lostComment = ['lost', 'booked_from_another_company'].includes(status)
    ? formatLostReasonDisplay(reason)
    : '';

  if (lead?.reactivation?.isReactivated &&
    ['follow_up', 'working_progress', 'contacted', 'negotiation', 'quotation_sent'].includes(status)) {
    return {
      label: 'Active',
      detail: optionLabel || '',
      pipelineLabel,
      title: optionLabel ? `Active — ${optionLabel}` : 'Active',
    };
  }

  if (optionLabel) {
    return {
      label: optionLabel,
      detail: pipelineLabel !== optionLabel ? pipelineLabel : '',
      pipelineLabel,
      title: `${optionLabel} · ${pipelineLabel}`,
    };
  }

  if (lostComment) {
    return {
      label: pipelineLabel,
      detail: lostComment,
      pipelineLabel,
      title: `${pipelineLabel} — ${lostComment}`,
    };
  }

  return {
    label: pipelineLabel,
    detail: '',
    pipelineLabel,
    title: pipelineLabel,
  };
}
