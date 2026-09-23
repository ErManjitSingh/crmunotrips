import { applyPeriodPreset } from './periodFilters';

/** Filters the Executive Lead Status report understands — the API query params, 1:1. */
const API_PARAM_KEYS = ['dateFrom', 'dateTo', 'source', 'executiveId', 'branchId'];

/** Default period matches the Lead Management page: Today (the "assigned today" view). */
export function createDefaultExecutiveLeadStatusFilters() {
  return { ...applyPeriodPreset('today'), source: '', executiveId: '', branchId: '' };
}

/** Query params for GET /leads/analytics/executive-lead-status — empty filters are omitted. */
export function toExecutiveLeadStatusParams(filters = {}) {
  return Object.fromEntries(
    API_PARAM_KEYS.map((key) => [key, filters[key]]).filter(([, value]) => value !== '' && value != null)
  );
}

/** YYYY-MM-DD strings sort lexicographically, so a plain comparison is a correct date compare. */
export function isDateRangeInvalid({ dateFrom, dateTo } = {}) {
  return Boolean(dateFrom && dateTo && dateFrom > dateTo);
}

/**
 * React Query `retry` for the report: the app's single retry for network / 5xx failures, none for a
 * 4xx (forbidden, invalid filter) — repeating those cannot succeed and only delays the error state.
 */
export function shouldRetryExecutiveLeadStatus(failureCount, error) {
  return (error?.response?.status ?? 500) >= 500 && failureCount < 1;
}

export function formatCount(value) {
  return Number(value || 0).toLocaleString('en-IN');
}

function formatDay(isoDay) {
  const [year, month, day] = String(isoDay).split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Human label for the assignment period the report is showing. */
export function describeAssignmentPeriod({ dateFrom, dateTo } = {}) {
  if (!dateFrom && !dateTo) return 'All time';
  if (dateFrom && dateTo) {
    return dateFrom === dateTo ? formatDay(dateFrom) : `${formatDay(dateFrom)} – ${formatDay(dateTo)}`;
  }
  return dateFrom ? `From ${formatDay(dateFrom)}` : `Until ${formatDay(dateTo)}`;
}

export const EXECUTIVE_LEAD_STATUS_PATH = '/leads/executive-lead-status';

/** The four buckets a lead can be in, in display order (matches the backend's `bucket` values). */
export const LEAD_BUCKETS = ['cold', 'warm', 'hot', 'unclassified'];

/**
 * Report filters <-> URL, so the selected period/source/branch survive a drill-down and the
 * browser Back button. No date params + `period=all` means All Time; no date params at all means
 * the default (Today), matching a first visit.
 */
export function filtersToSearchParams(filters = {}) {
  const params = new URLSearchParams();
  const { dateFrom, dateTo, source, executiveId, branchId } = filters;
  if (dateFrom) params.set('dateFrom', dateFrom);
  if (dateTo) params.set('dateTo', dateTo);
  if (!dateFrom && !dateTo) params.set('period', 'all');
  if (source) params.set('source', source);
  if (executiveId) params.set('executiveId', executiveId);
  if (branchId) params.set('branchId', branchId);
  return params;
}

export function filtersFromSearchParams(searchParams) {
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo = searchParams.get('dateTo') || '';
  const defaults = createDefaultExecutiveLeadStatusFilters();
  const hasPeriod = dateFrom || dateTo || searchParams.get('period') === 'all';
  return {
    dateFrom: hasPeriod ? dateFrom : defaults.dateFrom,
    dateTo: hasPeriod ? dateTo : defaults.dateTo,
    source: searchParams.get('source') || '',
    executiveId: searchParams.get('executiveId') || '',
    branchId: searchParams.get('branchId') || '',
  };
}

/** Overview URL carrying the given filters (Back-to-overview link). */
export function buildOverviewPath(filters) {
  return `${EXECUTIVE_LEAD_STATUS_PATH}?${filtersToSearchParams(filters)}`;
}

/** Drill-down URL for one executive: same period/source/branch, the executive comes from the path. */
export function buildExecutiveDetailPath(executiveId, filters, bucket = '') {
  const params = filtersToSearchParams({ ...filters, executiveId: '' });
  if (bucket) params.set('bucket', bucket);
  return `${EXECUTIVE_LEAD_STATUS_PATH}/${executiveId}?${params}`;
}

/** Query params for GET .../executive-lead-status/:executiveId/leads. */
export function toExecutiveLeadsParams(filters = {}, { bucket = '', page = 1, limit = 25 } = {}) {
  const { executiveId, ...report } = toExecutiveLeadStatusParams(filters);
  return { ...report, ...(bucket ? { bucket } : {}), page, limit };
}

/** assigned must equal cold + warm + hot + unclassified — anything else means overview/detail drifted. */
export function isSummaryConsistent(summary) {
  if (!summary) return true;
  return summary.assigned === LEAD_BUCKETS.reduce((sum, key) => sum + (summary[key] || 0), 0);
}

/** "21 Sep 2026" for an assignment timestamp, in IST — the timezone the report's periods are defined in. */
export function formatAssignedDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
}
