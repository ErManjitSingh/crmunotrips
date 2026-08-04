import { useQuery } from '@tanstack/react-query';
import API from '../api/axios';
import { buildListParams, unwrapPagination } from '../utils/apiHelpers';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

async function fetchRoleLeads(endpoint, { page, limit, filter, search, status, destination, priority, state, statusReason }) {
  const { data } = await API.get(endpoint, {
    params: buildListParams({
      page,
      limit,
      filters: {
        filter: filter && filter !== 'all' ? filter : filter === 'all' ? 'all' : undefined,
        search: search || undefined,
        status: status || undefined,
        destination: destination || undefined,
        priority: priority || undefined,
        state: state || undefined,
        statusReason: statusReason || undefined,
      },
    }),
    skipSuccessToast: true,
  });
  return unwrapPagination(data);
}

export function useRoleLeadsQuery({
  endpoint,
  filter,
  search = '',
  status = '',
  destination = '',
  priority = '',
  state = '',
  statusReason = '',
  page = 1,
  limit = 50,
  enabled = true,
  skipDebounce = false,
}) {
  const debouncedSearch = useDebouncedValue(search, 350);
  const resolvedSearch = skipDebounce ? search : debouncedSearch;

  return useQuery({
    queryKey: ['leads', endpoint, {
      filter,
      search: resolvedSearch,
      status,
      destination,
      priority,
      state,
      statusReason,
      page,
      limit,
    }],
    queryFn: () =>
      fetchRoleLeads(endpoint, {
        page,
        limit,
        filter,
        search: resolvedSearch,
        status,
        destination,
        priority,
        state,
        statusReason,
      }),
    enabled,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    placeholderData: (prev) => prev,
  });
}
