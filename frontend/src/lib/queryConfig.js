/** Shared React Query timing — tuned for 40+ concurrent sales users */
export const LIST_STALE_MS = 60_000;
export const DETAIL_STALE_MS = 60_000;
export const DASHBOARD_STALE_MS = 90_000;
/** Sidebar / KPI counts — keep near real-time */
export const NAV_COUNTS_STALE_MS = 15_000;
export const NAV_COUNTS_REFETCH_MS = 20_000;
export const ANALYTICS_STALE_MS = 120_000;
export const GC_TIME_MS = 10 * 60_000;
