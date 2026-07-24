import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'react-redux';
import store from '../store';
import { LIST_STALE_MS, GC_TIME_MS } from '../lib/queryConfig';
import { registerQueryClient } from '../lib/mutationCacheSync';
import { TooltipProvider } from '../components/ui/tooltip';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      staleTime: LIST_STALE_MS,
      gcTime: GC_TIME_MS,
    },
  },
});

export default function AppProviders({ children }) {
  useEffect(() => {
    registerQueryClient(queryClient);
  }, []);

  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
      </QueryClientProvider>
    </Provider>
  );
}

export { queryClient };
