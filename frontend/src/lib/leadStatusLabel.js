/**
 * Canonical lead status labels — Warm / Hot / Cold across the CRM.
 * Pipeline keys still exist in DB; UI maps them to temperature buckets.
 */
import { pipelineStatusToTemperatureLabel } from './leadTemperatureStatus';

const STATUS_LABELS = {
  new: 'No status',
  contacted: 'Warm',
  working_progress: 'Warm',
  qualified: 'Warm',
  quotation_sent: 'Hot',
  follow_up: 'Warm',
  negotiation: 'Hot',
  reactivated: 'Warm',
  converted: 'Booking',
  lost: 'Cold',
  booked_from_another_company: 'Cold',
  warm: 'Warm',
  hot: 'Hot',
  cold: 'Cold',
};

const STATUS_MEANINGS = {
  warm: 'Package discussed / callback / CNP / price negotiation',
  hot: 'Ready to Book',
  cold: 'Booked elsewhere / language / not interested / invalid / budget',
  new: 'Lead just received — no Warm/Hot/Cold set yet',
  converted: 'Customer has confirmed / paid',
};

export function getLeadStatusLabel(status) {
  if (!status) return '—';
  if (STATUS_LABELS[status]) return STATUS_LABELS[status];
  return pipelineStatusToTemperatureLabel(status);
}

export function getLeadStatusMeaning(status) {
  if (!status) return '';
  const bucket = STATUS_LABELS[status] || pipelineStatusToTemperatureLabel(status);
  const key = String(bucket).toLowerCase().replace(/\s+/g, '_');
  if (key === 'booking') return STATUS_MEANINGS.converted;
  if (key === 'no_status') return STATUS_MEANINGS.new;
  return STATUS_MEANINGS[key] || STATUS_MEANINGS[status] || '';
}

export { STATUS_LABELS, STATUS_MEANINGS };
