import { useQuery } from '@tanstack/react-query';
import API from '../../../api/axios';
import { DASHBOARD_STALE_MS, GC_TIME_MS } from '../../../lib/queryConfig';

export function buildDashboardParams(filters = {}, { fresh = false } = {}) {
  const params = {};
  if (filters.dateFrom) params.dateFrom = filters.dateFrom;
  if (filters.dateTo) params.dateTo = filters.dateTo;
  if (filters.source) params.source = filters.source;
  if (fresh) params.fresh = '1';
  return params;
}

export function dashboardQueryKey(endpoint = '/dashboard/stats', filters = {}) {
  return [
    'dashboard',
    endpoint,
    {
      dateFrom: filters.dateFrom || '',
      dateTo: filters.dateTo || '',
      source: filters.source || '',
    },
  ];
}

export function useDashboardQuery(endpoint = '/dashboard/stats', filters = {}) {
  return useQuery({
    queryKey: dashboardQueryKey(endpoint, filters),
    queryFn: async () => {
      const { data } = await API.get(endpoint, {
        params: buildDashboardParams(filters),
        skipSuccessToast: true,
      });
      return data;
    },
    staleTime: DASHBOARD_STALE_MS,
    gcTime: GC_TIME_MS,
    placeholderData: (prev) => prev,
  });
}
