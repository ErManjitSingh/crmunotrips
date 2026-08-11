/** Shared React Query timing — tuned to cut API load under concurrent CRM users */
export const LIST_STALE_MS = 90_000;
export const DETAIL_STALE_MS = 90_000;
export const DASHBOARD_STALE_MS = 3 * 60_000;
/** Sidebar counts — Redis absorbs concurrent users; poll slowly */
export const NAV_COUNTS_STALE_MS = 2 * 60_000;
export const NAV_COUNTS_REFETCH_MS = 3 * 60_000;
export const ANALYTICS_STALE_MS = 3 * 60_000;
export const GC_TIME_MS = 15 * 60_000;
