/**
 * Resolve a list total for headers/pagination.
 * Never coerce unknown totals to 0 when rows are visible.
 */
export function resolveListTotal({
  apiTotal,
  rowCount = 0,
  pageIndex = 0,
  pageSize = 50,
  hasMore = false,
  fallbackTotal,
} = {}) {
  const api = typeof apiTotal === 'number' && Number.isFinite(apiTotal) ? apiTotal : null;
  const fallback =
    typeof fallbackTotal === 'number' && Number.isFinite(fallbackTotal) ? fallbackTotal : null;

  if (api != null && api > 0) return api;

  // Rows visible but API said 0/null — prefer nav fallback, else estimate from page
  if (rowCount > 0 && (api == null || api === 0)) {
    if (fallback != null && fallback > 0) return fallback;
    const seen = pageIndex * pageSize + rowCount;
    return hasMore ? seen + 1 : seen;
  }

  if (api === 0) return fallback != null && fallback > 0 ? fallback : 0;
  if (fallback != null) return fallback;
  return null;
}
