import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { focusManager, QueryClient, type Query } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useEffect, type ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import {
  CACHE_BUSTER,
  CACHE_MAX_AGE_MS,
  CACHE_STORAGE_KEY,
  pruneSaved,
  shouldSave,
} from './cache-rules';
import { ApiError } from './client';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Retry transient failures (network, 5xx) but not answers the server meant (4xx).
      retry: (count, error) => count < 2 && !(error instanceof ApiError && error.status < 500),
      // Keep the last good answer around a long time so a failed poll shows stale data, not a blank.
      // Must be at least the saved cache's max age, or restored answers could be thrown away at once.
      gcTime: CACHE_MAX_AGE_MS,
    },
  },
});

// The last good station, schedule and now-playing answers are kept on the phone (which ones, and for how
// long, is decided in cache-rules.ts), so a launch with no signal still has something to show.
const storedCache = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: CACHE_STORAGE_KEY,
  throttleTime: 2000,
});
const persistOptions = {
  persister: {
    ...storedCache,
    restoreClient: async () => {
      const saved = await storedCache.restoreClient();
      return saved && pruneSaved(saved, Date.now());
    },
  },
  maxAge: CACHE_MAX_AGE_MS,
  buster: CACHE_BUSTER,
  dehydrateOptions: {
    // Not "status === 'success'" (the default): a query whose latest refresh failed still holds its last
    // good data, and dropping it here would lose that answer on the next write.
    shouldDehydrateQuery: (query: Query) => query.state.data !== undefined && shouldSave(query.queryKey),
  },
};

/** Tell React Query when the app is foregrounded and when the phone gets its connection back. */
export function QueryProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const sub = AppState.addEventListener('change', (status: AppStateStatus) => {
      focusManager.setFocused(status === 'active');
    });
    return () => sub.remove();
  }, []);

  // Queries keep trying while offline (so screens show their own "couldn't load" message), but they only
  // retry on a timer. Refresh what is on screen the moment the connection comes back.
  useEffect(() => {
    let wasOnline = true;
    return NetInfo.addEventListener((state) => {
      const online = state.isConnected !== false;
      if (online && !wasOnline) void queryClient.refetchQueries({ type: 'active' });
      wasOnline = online;
    });
  }, []);

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      {children}
    </PersistQueryClientProvider>
  );
}
