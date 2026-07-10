import { useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSelector } from 'react-redux';
import { useAuth } from '../context/AuthContext';
import API from '../api/axios';
import { NAV_COUNTS_STALE_MS, GC_TIME_MS } from '../lib/queryConfig';
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
      const { data } = await API.get('/nav-counts', {
        skipSuccessToast: true,
        skipErrorToast: true,
      });
      return data;
    },
    enabled: enabled && !!userId,
    staleTime: NAV_COUNTS_STALE_MS,
    gcTime: GC_TIME_MS,
    placeholderData: (prev) => prev,
    retry: 1,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const refresh = useCallback(() => {
    invalidateNavCounts(queryClient);
  }, [queryClient]);

  useEffect(() => {
    if (!enabled || !userId) return undefined;
    const onUnread = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => refresh(), 3000);
    };
    window.addEventListener('notifications:unread', onUnread);
    return () => {
      window.removeEventListener('notifications:unread', onUnread);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [enabled, userId, refresh]);

  return query.data ?? null;
}
