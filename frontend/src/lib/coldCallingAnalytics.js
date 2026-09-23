import {
  EXECUTIVE_LEAD_STATUS_PATH,
  createDefaultExecutiveLeadStatusFilters,
  filtersFromSearchParams,
  filtersToSearchParams,
} from './executiveLeadStatusFilters';
import { getStatusReasonLabel } from './executiveStatusDisplay';

/**
 * Cold Calling analytics (Admin): URL <-> filters, request params, and display formatting only.
 * Every number on the page comes from the server — nothing here computes a business metric.
 */

export const COLD_CALLING_VIEW = 'cold-calling';
export const COLD_CALLING_ANALYTICS_PATH = `${EXECUTIVE_LEAD_STATUS_PATH}/cold-calling`;

const API_KEYS = ['dateFrom', 'dateTo', 'source', 'agentId', 'branchId'];

/** Same default period as the Sales Executives tab (Today), plus the agent filter. */
export function createDefaultColdCallingFilters() {
  const { executiveId, ...base } = createDefaultExecutiveLeadStatusFilters();
  return { ...base, agentId: '' };
}

/** `?view=cold-calling&dateFrom=…&agentId=…` — the shared period/source/branch parsing, plus the agent. */
export function coldCallingFiltersFromSearchParams(searchParams) {
  const { executiveId, ...base } = filtersFromSearchParams(searchParams);
  return { ...base, agentId: searchParams.get('agentId') || '' };
}

export function coldCallingFiltersToSearchParams(filters = {}) {
  const { agentId, ...rest } = filters;
  const params = filtersToSearchParams(rest);
  params.set('view', COLD_CALLING_VIEW);
  if (agentId) params.set('agentId', agentId);
  return params;
}

/** Query params for the analytics endpoints — empty filters are omitted. */
export function toColdCallingParams(filters = {}) {
  return Object.fromEntries(API_KEYS.map((key) => [key, filters[key]]).filter(([, value]) => value !== '' && value != null));
}

/** Overview URL carrying the filters (the Back link from an agent). */
export function buildColdCallingOverviewPath(filters) {
  return `${EXECUTIVE_LEAD_STATUS_PATH}?${coldCallingFiltersToSearchParams(filters)}`;
}

/** Agent detail URL: same period/source/branch, the agent comes from the path (so it is not also a query param). */
export function buildColdCallingAgentPath(agentId, filters) {
  const params = coldCallingFiltersToSearchParams({ ...filters, agentId: '' });
  params.delete('view');
  return `${COLD_CALLING_ANALYTICS_PATH}/${agentId}?${params}`;
}

/** Switching tabs keeps period / source / branch and drops the tab-specific executive / agent. */
export function switchAnalyticsView(searchParams, view) {
  if (view === COLD_CALLING_VIEW) {
    return coldCallingFiltersToSearchParams({ ...coldCallingFiltersFromSearchParams(searchParams), agentId: '' });
  }
  return filtersToSearchParams({ ...filtersFromSearchParams(searchParams), executiveId: '' });
}

/** Overview 4xx (forbidden, invalid filter) can never succeed on retry. */
export function shouldRetryColdCalling(failureCount, error) {
  return (error?.response?.status ?? 500) >= 500 && failureCount < 1;
}

/* ---------------------------------------------------------------- display formatting */

export const dash = '—';

export function formatNumber(value) {
  return value == null ? dash : Number(value).toLocaleString('en-IN');
}

/** A ratio the server already computed (null when its denominator is zero). */
export function formatPercent(value) {
  return value == null ? dash : `${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 1 })}%`;
}

/** m:ss (h:mm:ss from an hour up) for a duration in seconds; null (no connected calls) is an em dash. */
export function formatDuration(seconds) {
  if (seconds == null) return dash;
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

/** "3h 20m" style total talk time. */
export function formatTalkTime(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m`;
  return total ? `${total}s` : '0m';
}

export const MOVEMENT_LABELS = {
  cold_to_warm: 'Cold → Warm',
  cold_to_hot: 'Cold → Hot',
  cold_to_converted: 'Cold → Converted',
  still_cold: 'Still Cold',
};

export const MOVEMENT_HINTS = {
  cold_to_warm: 'Assigned leads that reached Warm at any point after assignment (status movement history).',
  cold_to_hot: 'Assigned leads that reached Hot at any point after assignment, including via Warm (status movement history).',
  cold_to_converted: 'Assigned leads whose current status is Converted. Conversions are not part of the movement history.',
  still_cold: 'Assigned leads that are currently Cold.',
};

/** Theme key used to colour each movement row. */
export const MOVEMENT_THEME = { cold_to_warm: 'warm', cold_to_hot: 'hot', cold_to_converted: 'converted', still_cold: 'cold' };

export const OUTCOME_BUCKET_LABELS = { connected: 'Connected', no_answer: 'No answer', failed: 'Failed / other' };

/** CRM wording for a call outcome key (same option labels as the post-call form). */
export function outcomeLabel(outcome) {
  if (!outcome) return dash;
  return getStatusReasonLabel(outcome) || String(outcome).replace(/_/g, ' ');
}

/** Reason text beside a status badge: the lead's own reason, or "Converted". */
export function describeCategoryReason({ category, statusReason }) {
  if (category === 'converted') return 'Converted';
  if (category === 'unclassified') return dash;
  return getStatusReasonLabel(statusReason) || dash;
}

export function formatDateTime(value) {
  if (!value) return dash;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return dash;
  return date.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
}

/** Overview KPI cards, in display order. Values are the server's; this only decides labels/hints. */
export function buildKpiCards(summary = {}) {
  return [
    { key: 'totalColdLeads', label: 'Total Cold Leads', tone: 'cold', value: summary.totalColdLeads, hint: 'Cold leads in the Sales pool (same population as the Sales Executives tab)' },
    { key: 'assigned', label: 'Assigned Leads', tone: 'assigned', value: summary.assigned, hint: 'Leads assigned to Cold Calling in the period' },
    { key: 'worked', label: 'Worked Leads', tone: 'converted', value: summary.worked, hint: 'Assigned leads with at least one Cold Calling call' },
    { key: 'unworked', label: 'Unworked Leads', tone: 'unclassified', value: summary.unworked, hint: 'Assigned − Worked' },
    { key: 'workRate', label: 'Work Rate', tone: 'assigned', value: summary.workRate, format: 'percent', hint: 'Worked ÷ Assigned' },
    { key: 'totalCalls', label: 'Total Calls', tone: 'warm', value: summary.totalCalls, hint: 'Every Cold Calling call counts once' },
    { key: 'connectedCalls', label: 'Connected Calls', tone: 'converted', value: summary.connectedCalls, hint: 'Calls whose outcome means the guest answered (Call Report rule)' },
    { key: 'avgCallDurationSec', label: 'Avg Call Duration', tone: 'hot', value: summary.avgCallDurationSec, format: 'duration', hint: 'Average of connected calls with a recorded duration (Call Report rule)' },
  ];
}

export function formatKpi(card) {
  if (card.format === 'percent') return formatPercent(card.value);
  if (card.format === 'duration') return formatDuration(card.value);
  return formatNumber(card.value);
}

/** Agent-detail KPI cards (no "Total Cold Leads": that is a pool figure, not an agent's). */
export function buildAgentKpiCards(summary = {}) {
  return buildKpiCards(summary).filter((card) => card.key !== 'totalColdLeads');
}

export const LEAD_CATEGORY_FILTERS = [
  { value: '', label: 'All' },
  { value: 'cold', label: 'Cold' },
  { value: 'warm', label: 'Warm' },
  { value: 'hot', label: 'Hot' },
  { value: 'converted', label: 'Converted' },
  { value: 'lost', label: 'Lost' },
];

export const CATEGORY_LABELS = {
  cold: 'Cold', warm: 'Warm', hot: 'Hot', converted: 'Converted', lost: 'Lost / Closed', unclassified: 'Unclassified',
};
