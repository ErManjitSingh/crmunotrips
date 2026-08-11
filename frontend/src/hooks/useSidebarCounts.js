import { useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';
import { NAV_COUNTS_STALE_MS, NAV_COUNTS_REFETCH_MS, GC_TIME_MS } from '../lib/queryConfig';
import { invalidateNavCounts } from '../lib/queryInvalidation';

/** Module-level debounce so multiple mounts don't stampede Redis/Mongo */
let sharedUnreadTimer = null;
let sharedVisibleTimer = null;

export function useSidebarCounts(enabled = true) {
  const { user } = useAuth();
  const { selectedBranchId } = useSelector((s) => s.branch);
  const queryClient = useQueryClient();
  const userId = user?._id || user?.id;
  const debounceRef = useRef(null);

  const query = useQuery({
    queryKey: ['nav-counts', String(userId || ''), user?.role, selectedBranchId || 'all'],
    queryFn: async () => {
      // Do NOT send fresh=1 on poll — that busts Redis and stampedes Mongo under load.
      const { data } = await API.get('/nav-counts', {
        skipSuccessToast: true,
        skipErrorToast: true,
      });
      return data;
    },
    enabled: enabled && !!userId,
    staleTime: NAV_COUNTS_STALE_MS,
    gcTime: GC_TIME_MS,
    refetchInterval: NAV_COUNTS_REFETCH_MS,
    refetchIntervalInBackground: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: 1,
  });

  const refresh = useCallback(() => {
    invalidateNavCounts(queryClient);
  }, [queryClient]);

  useEffect(() => {
    if (!enabled || !userId) return undefined;

    const onUnread = () => {
      if (sharedUnreadTimer) clearTimeout(sharedUnreadTimer);
      sharedUnreadTimer = setTimeout(() => {
        sharedUnreadTimer = null;
        refresh();
      }, 2500);
    };

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      // Soft: only refetch if data is already stale — avoid focus stampede
      if (sharedVisibleTimer) clearTimeout(sharedVisibleTimer);
      sharedVisibleTimer = setTimeout(() => {
        sharedVisibleTimer = null;
        const state = queryClient.getQueryState([
          'nav-counts',
          String(userId || ''),
          user?.role,
          selectedBranchId || 'all',
        ]);
        const updatedAt = state?.dataUpdatedAt || 0;
        if (Date.now() - updatedAt < NAV_COUNTS_STALE_MS) return;
        queryClient.refetchQueries({ queryKey: ['nav-counts'], type: 'active' });
      }, 800);
    };

    window.addEventListener('notifications:unread', onUnread);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('notifications:unread', onUnread);
      document.removeEventListener('visibilitychange', onVisible);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [enabled, userId, user?.role, selectedBranchId, refresh, queryClient]);

  return query.data ?? null;
}
