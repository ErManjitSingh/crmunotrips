/** Scoped cache invalidation — avoids refetching every lead query on one mutation */

export function invalidateLeadLists(queryClient) {
  return queryClient.invalidateQueries({
    predicate: (q) => q.queryKey[0] === 'leads',
  });
}

export function invalidateNavCounts(queryClient) {
  return queryClient.invalidateQueries({ queryKey: ['nav-counts'] });
}

export function invalidateLeadDetail(queryClient, leadId) {
  if (!leadId) return Promise.resolve();
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['lead', leadId] }),
    queryClient.invalidateQueries({ queryKey: ['lead-timeline', leadId] }),
    queryClient.invalidateQueries({ queryKey: ['lead-audit', leadId] }),
    queryClient.invalidateQueries({ queryKey: ['lead-transfer-history', leadId] }),
  ]);
}

export function invalidateDashboard(queryClient) {
  return queryClient.invalidateQueries({ queryKey: ['dashboard'] });
}
