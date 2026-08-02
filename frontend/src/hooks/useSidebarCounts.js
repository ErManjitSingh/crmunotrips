import { useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';
import { NAV_COUNTS_STALE_MS, NAV_COUNTS_REFETCH_MS, GC_TIME_MS } from '../lib/queryConfig';
import { invalidateNavCounts } from '../lib/queryInvalidation';

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
      // Manual refresh (appRefresh / invalidate) can still pass fresh when needed.
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
    refetchOnMount: true,
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
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => refresh(), 1500);
    };
    const onVisible = () => {
      // Soft refetch only when data is stale — do not force cache bust
      if (document.visibilityState === 'visible') {
        queryClient.refetchQueries({ queryKey: ['nav-counts'], type: 'active' });
      }
    };
    window.addEventListener('notifications:unread', onUnread);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('notifications:unread', onUnread);
      document.removeEventListener('visibilitychange', onVisible);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [enabled, userId, refresh, queryClient]);

  return query.data ?? null;
}
