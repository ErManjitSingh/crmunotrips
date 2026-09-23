import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  fetchCallNotes,
  fetchColdCallingAgentDetail,
  fetchColdCallingAgentLeads,
  fetchColdCallingAnalytics,
} from '../../../services/leadEnterpriseApi';
import { shouldRetryColdCalling, toColdCallingParams } from '../../../lib/coldCallingAnalytics';
import { LIST_STALE_MS, GC_TIME_MS } from '../../../lib/queryConfig';

// The 'leads' key prefix means the existing lead-mutation invalidation (assign, status change, call
// note…) refreshes these reports too, and each distinct filter set is its own cache entry.

/** Overview: summary + distribution + movements + outcomes + agents, in ONE request. */
export function useColdCallingAnalyticsQuery(filters) {
  const params = toColdCallingParams(filters);
  return useQuery({
    queryKey: ['leads', 'cold-calling-analytics', 'overview', params],
    queryFn: () => fetchColdCallingAnalytics(params),
    staleTime: LIST_STALE_MS,
    gcTime: GC_TIME_MS,
    retry: shouldRetryColdCalling,
  });
}

/** One agent's overview (same filters minus the agent, which is the route param). */
export function useColdCallingAgentQuery(agentId, filters) {
  const { agentId: _ignored, ...params } = toColdCallingParams(filters);
  return useQuery({
    queryKey: ['leads', 'cold-calling-analytics', 'agent', agentId, params],
    queryFn: () => fetchColdCallingAgentDetail(agentId, params),
    enabled: Boolean(agentId),
    staleTime: LIST_STALE_MS,
    gcTime: GC_TIME_MS,
    retry: shouldRetryColdCalling,
  });
}

/** One page of an agent's leads. The previous page stays on screen while the next one loads. */
export function useColdCallingAgentLeadsQuery(agentId, filters, { category, activity, page, limit }) {
  const { agentId: _ignored, ...base } = toColdCallingParams(filters);
  const params = { ...base, ...(category ? { category } : {}), ...(activity ? { activity } : {}), page, limit };
  return useQuery({
    queryKey: ['leads', 'cold-calling-analytics', 'agent-leads', agentId, params],
    queryFn: () => fetchColdCallingAgentLeads(agentId, params),
    enabled: Boolean(agentId),
    placeholderData: keepPreviousData,
    staleTime: LIST_STALE_MS,
    gcTime: GC_TIME_MS,
    retry: shouldRetryColdCalling,
  });
}

/** Full call history of one lead for Admin — the existing endpoint, every call individually. Fetched only when opened. */
export function useLeadCallHistoryQuery(leadId, enabled) {
  return useQuery({
    queryKey: ['leads', 'call-history', leadId],
    queryFn: () => fetchCallNotes(leadId, { limit: 100 }),
    enabled: Boolean(enabled && leadId),
    staleTime: 0,
    retry: shouldRetryColdCalling,
  });
}
