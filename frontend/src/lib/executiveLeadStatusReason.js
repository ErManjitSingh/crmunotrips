import { getStatusReasonLabel } from './executiveStatusDisplay';

/**
 * The reason shown beside a lead's status in the Executive Lead Status drill-down.
 *
 * `bucket` is the backend's classification and is never re-derived here. For Cold / Warm / Hot the
 * reason is the lead's own statusReason, in the CRM's existing option wording. An Unclassified lead
 * deliberately never shows its statusReason (that would read like a Cold/Warm/Hot reason it does not
 * have): a converted lead says so, anything else shows '—'.
 */
export function describeLeadStatusReason({ bucket, status, statusReason } = {}) {
  if (bucket === 'cold' || bucket === 'warm' || bucket === 'hot') {
    return getStatusReasonLabel(statusReason) || '—';
  }
  return status === 'converted' ? 'Converted' : '—';
}
