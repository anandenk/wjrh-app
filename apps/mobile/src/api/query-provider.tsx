import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { ApiError } from './client';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Retry transient failures (network, 5xx) but not answers the server meant (4xx).
      retry: (count, error) => count < 2 && !(error instanceof ApiError && error.status < 500),
      // Keep the last good answer around a long time so a failed poll shows stale data, not a blank.
      gcTime: 24 * 60 * 60 * 1000,
    },
  },
});

/** Tell React Query when the app is foregrounded (it only knows about browser tabs by default). */
export function QueryProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const sub = AppState.addEventListener('change', (status: AppStateStatus) => {
      focusManager.setFocused(status === 'active');
    });
    return () => sub.remove();
  }, []);
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
