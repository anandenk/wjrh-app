import type { PersistedClient } from '@tanstack/react-query-persist-client';

import { SCHEMA_VERSION } from './schema-version';

// What the app keeps on the phone between runs, so a launch with no signal still shows the station info
// and schedule. Pure functions only (no React Native imports), so they can be tested with `npm test`.
// The wiring is in query-provider.tsx. Live audio never reads any of this (it plays from the stream URL).

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** The whole saved cache is dropped when it was last written longer ago than this. */
export const CACHE_MAX_AGE_MS = 7 * DAY;

/**
 * Bump this when the way answers are saved changes. The schema hash is added automatically, so a changed
 * API response shape discards old data without anyone remembering to bump anything.
 */
const CACHE_FORMAT = 1;
export const CACHE_BUSTER = `${CACHE_FORMAT}-${SCHEMA_VERSION}`;

/** Where the cache lives in AsyncStorage. */
export const CACHE_STORAGE_KEY = 'wjrh-query-cache';

/** The time the app started. An answer older than this came from an earlier run. */
export const APP_STARTED_AT = Date.now();

type SavedKind = 'station' | 'shows' | 'schedule' | 'now-playing';

/** How long a saved answer may be used after a restart. Anything not listed here is never saved. */
const MAX_AGE_MS: Record<SavedKind, number> = {
  station: 7 * DAY,
  shows: 7 * DAY,
  schedule: 7 * DAY,
  // Only useful as "last known" for a short while: an old track is not what is playing.
  'now-playing': HOUR,
};

// Query keys are defined in queries.ts. Health, recent tracks and archives are deliberately not saved.
function savedKind(queryKey: readonly unknown[]): SavedKind | null {
  switch (queryKey[0]) {
    case 'station':
    case 'schedule':
    case 'now-playing':
      return queryKey[0];
    case 'shows':
      // ['shows'] is the show list. ['shows', id, 'archives'] is an archive list: not saved.
      return queryKey.length === 1 ? 'shows' : null;
    default:
      return null;
  }
}

/** Is this kind of answer one we keep on the phone? */
export function shouldSave(queryKey: readonly unknown[]): boolean {
  return savedKind(queryKey) !== null;
}

/**
 * Applied to what was read back from storage: drops answers that are too old for their kind and anything
 * that is not a plain saved query (such as pending mutations).
 *
 * A query whose latest refresh failed still holds its last good data, and that is saved too (see
 * query-provider.tsx), or a second launch with no signal would find nothing. It comes back as a plain
 * success: its data keeps its original time, but a restored error would put "last known info" notices
 * on screen while the new request is still in flight.
 */
export function pruneSaved(saved: PersistedClient, now: number): PersistedClient {
  const queries = saved.clientState.queries
    .filter((q) => {
      const kind = savedKind(q.queryKey);
      return kind !== null && q.state.data !== undefined && now - q.state.dataUpdatedAt <= MAX_AGE_MS[kind];
    })
    .map((q) => ({
      ...q,
      state: {
        ...q.state,
        status: 'success' as const,
        error: null,
        errorUpdateCount: 0,
        fetchFailureCount: 0,
        fetchFailureReason: null,
      },
    }));
  return { ...saved, clientState: { mutations: [], queries } };
}

/** True when an answer was fetched by an earlier run of the app, not this one. */
export function isFromEarlierRun(dataUpdatedAt: number, startedAt: number = APP_STARTED_AT): boolean {
  return dataUpdatedAt < startedAt;
}
