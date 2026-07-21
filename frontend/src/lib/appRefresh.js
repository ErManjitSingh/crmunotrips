import API from '../api/axios';
import { invalidateLeadLists } from './queryInvalidation';

const FRESH_PARAMS = { fresh: 1 };

async function refetchActiveDashboards(queryClient) {
  const queries = queryClient
    .getQueryCache()
    .findAll({ queryKey: ['dashboard'], type: 'active' });

  await Promise.all(
    queries.map((query) => {
      const endpoint = query.queryKey[1] || '/dashboard/stats';
      return queryClient.fetchQuery({
        queryKey: query.queryKey,
        queryFn: async () => {
          const { data } = await API.get(endpoint, {
            params: FRESH_PARAMS,
            skipSuccessToast: true,
          });
          return data;
        },
      });
    })
  );
}

async function refetchActiveNavCounts(queryClient) {
  const queries = queryClient
    .getQueryCache()
    .findAll({ queryKey: ['nav-counts'], type: 'active' });

  await Promise.all(
    queries.map((query) =>
      queryClient.fetchQuery({
        queryKey: query.queryKey,
        queryFn: async () => {
          const { data } = await API.get('/nav-counts', {
            params: FRESH_PARAMS,
            skipSuccessToast: true,
            skipErrorToast: true,
          });
          return data;
        },
      })
    )
  );
}

/** Manual top-bar refresh — bypasses server cache once per active query family. */
export async function refreshAppData(queryClient) {
  await Promise.all([
    invalidateLeadLists(queryClient),
    refetchActiveDashboards(queryClient),
    refetchActiveNavCounts(queryClient),
    queryClient.refetchQueries({ queryKey: ['followups'], type: 'active' }),
    queryClient.refetchQueries({ queryKey: ['quotations'], type: 'active' }),
    queryClient.refetchQueries({ queryKey: ['reports'], type: 'active' }),
    queryClient.refetchQueries({ queryKey: ['whatsapp'], type: 'active' }),
  ]);
}
