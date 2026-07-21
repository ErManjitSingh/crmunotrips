import API from '../api/axios';

const FRESH_PARAMS = { fresh: 1 };

async function refetchActiveDashboards(queryClient) {
  const queries = queryClient
    .getQueryCache()
    .findAll({ queryKey: ['dashboard'], type: 'active' });

  await Promise.all(
    queries.map((query) => {
      const endpoint = query.queryKey[1] || '/dashboard/stats';
      const filters =
        query.queryKey[2] && typeof query.queryKey[2] === 'object' ? query.queryKey[2] : {};
      return queryClient.fetchQuery({
        queryKey: query.queryKey,
        queryFn: async () => {
          const { data } = await API.get(endpoint, {
            params: { ...filters, ...FRESH_PARAMS },
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
  // Mark everything stale without triggering duplicate requests. The explicit
  // fetches below can then bypass server caches for dashboard/count endpoints.
  await queryClient.invalidateQueries({ refetchType: 'none' });

  await Promise.all([
    refetchActiveDashboards(queryClient),
    refetchActiveNavCounts(queryClient),
    queryClient.refetchQueries({
      type: 'active',
      predicate: (query) => !['dashboard', 'nav-counts'].includes(query.queryKey[0]),
    }),
  ]);
}
