import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import API from '../../../api/axios';
import {
  assignLeadsToColdCalling,
  fetchColdCallingAgents,
  fetchExecutiveLeadStatus,
  fetchExecutiveLeadStatusLeads,
  fetchMyColdCallingLeads,
} from '../../../services/leadEnterpriseApi';
import {
  shouldRetryExecutiveLeadStatus,
  toExecutiveLeadStatusParams,
  toExecutiveLeadsParams,
} from '../../../lib/executiveLeadStatusFilters';
import { LIST_STALE_MS, GC_TIME_MS } from '../../../lib/queryConfig';

/**
 * The 'leads' key prefix means the existing lead-mutation invalidation (assign / status change /
 * call note → invalidateLeadLists / keysFromMutationUrl) refreshes this report automatically.
 */
export function useExecutiveLeadStatusQuery(filters) {
  const params = toExecutiveLeadStatusParams(filters);
  return useQuery({
    queryKey: ['leads', 'executive-lead-status', params],
    queryFn: () => fetchExecutiveLeadStatus(params),
    staleTime: LIST_STALE_MS,
    gcTime: GC_TIME_MS,
    retry: shouldRetryExecutiveLeadStatus,
  });
}

/** One executive's leads for the drill-down. Same 'leads' key prefix, so lead mutations refresh it too. */
export function useExecutiveLeadStatusLeadsQuery({ executiveId, filters, bucket, page, limit }) {
  const params = toExecutiveLeadsParams(filters, { bucket, page, limit });
  return useQuery({
    queryKey: ['leads', 'executive-lead-status', 'leads', executiveId, params],
    queryFn: () => fetchExecutiveLeadStatusLeads(executiveId, params),
    staleTime: LIST_STALE_MS,
    gcTime: GC_TIME_MS,
    retry: shouldRetryExecutiveLeadStatus,
    enabled: Boolean(executiveId),
  });
}

const EXECUTIVE_OPTIONS_STALE_MS = 5 * 60_000;

/** Active sales executives for the Executive filter (light endpoint the assign modals already use). */
export function useExecutiveFilterOptions(branchId) {
  return useQuery({
    queryKey: ['executive-lead-status', 'executive-options', branchId || 'active-branch'],
    queryFn: async () => {
      const { data } = await API.get('/leads/assignees', {
        params: branchId ? { branchId } : undefined,
        skipSuccessToast: true,
        skipErrorToast: true,
      });
      return Array.isArray(data?.salesExecutives) ? data.salesExecutives : [];
    },
    staleTime: EXECUTIVE_OPTIONS_STALE_MS,
    gcTime: GC_TIME_MS,
  });
}

const COLD_CALLING_AGENTS_STALE_MS = 60_000;

/** Active Cold Calling users for the assignment picker; fetched only when the modal is open. */
export function useColdCallingAgents(enabled, branchId) {
  return useQuery({
    queryKey: ['executive-lead-status', 'cold-calling-agents', branchId || 'active-branch'],
    queryFn: () => fetchColdCallingAgents(branchId),
    enabled: Boolean(enabled),
    staleTime: COLD_CALLING_AGENTS_STALE_MS,
    gcTime: GC_TIME_MS,
    retry: shouldRetryExecutiveLeadStatus,
  });
}

/**
 * Assign selected Cold leads to an agent. Invalidates the 'leads' key prefix, which refreshes the
 * drill-down (indicator) and the overview counts.
 */
export function useAssignColdLeadsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: assignLeadsToColdCalling,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leads'] }),
    // A 409 means the screen was stale (someone else assigned / changed those leads): refresh it.
    onError: (error) => {
      if (error?.response?.status === 409) queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}

/** The signed-in Cold Caller's own assignments. Server-scoped by session; no id is ever sent. */
export function useMyColdCallingLeadsQuery({ page, limit }) {
  return useQuery({
    queryKey: ['cold-calling', 'my-leads', { page, limit }],
    queryFn: () => fetchMyColdCallingLeads({ page, limit }),
    staleTime: LIST_STALE_MS,
    gcTime: GC_TIME_MS,
    retry: shouldRetryExecutiveLeadStatus,
    placeholderData: keepPreviousData,
  });
}
