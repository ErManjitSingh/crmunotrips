/** Normalize paginated or legacy array API responses */
export function unwrapList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

export function unwrapPagination(payload) {
  if (Array.isArray(payload)) {
    return {
      data: payload,
      pagination: { page: 1, limit: payload.length, total: payload.length, totalPages: 1 },
      nextCursor: null,
      hasMore: false,
    };
  }
  return {
    data: payload?.data ?? [],
    pagination: payload?.pagination ?? { page: 1, limit: 25, total: 0, totalPages: 0 },
    nextCursor: payload?.nextCursor ?? null,
    hasMore: payload?.hasMore ?? false,
  };
}

export function buildListParams({ page = 1, limit = 25, sortBy, sortOrder, cursor, filters = {} } = {}) {
  const { budgetRange, ...rest } = filters;
  const params = { page, limit, ...rest };
  if (cursor) params.cursor = cursor;
  if (sortBy) params.sortBy = sortBy;
  if (sortOrder) params.sortOrder = sortOrder;
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== '' && v !== undefined && v !== null)
  );
}
