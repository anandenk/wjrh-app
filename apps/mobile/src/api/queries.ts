// TanStack Query hooks, one per endpoint. Polling intervals follow the screen -> endpoint table in
// docs/mobile-app/plan.md. Polling pauses when the app is in the background (refetchIntervalInBackground
// is false by default), and a failed poll keeps the last good `data`: use `isShowingStale` to label it.
import { keepPreviousData, useQuery, type UseQueryResult } from '@tanstack/react-query';

import { FEATURES } from '@/config';

import {
  getArchives,
  getHealth,
  getNowPlaying,
  getRecent,
  getSchedule,
  getShowArchives,
  getShows,
  getStation,
  getWeeklySchedule,
} from './endpoints';

const SECOND = 1000;
const MINUTE = 60 * SECOND;

export const queryKeys = {
  health: ['health'] as const,
  nowPlaying: ['now-playing'] as const,
  recent: (limit: number) => ['recent', limit] as const,
  station: ['station'] as const,
  shows: ['shows'] as const,
  weekly: (week?: string) => ['schedule', 'weekly', week ?? 'current'] as const,
  schedule: (from: string, to: string) => ['schedule', from, to] as const,
  archives: ['archives'] as const,
  showArchives: (showId: string) => ['shows', showId, 'archives'] as const,
};

/** True when the latest refresh failed but an older answer is still available to show. */
export function isShowingStale(q: Pick<UseQueryResult, 'isError' | 'data'>): boolean {
  return q.isError && q.data !== undefined;
}

export const useNowPlaying = () =>
  useQuery({
    queryKey: queryKeys.nowPlaying,
    queryFn: ({ signal }) => getNowPlaying(signal),
    refetchInterval: 15 * SECOND,
  });

export const useRecent = (limit = 20) =>
  useQuery({
    queryKey: queryKeys.recent(limit),
    queryFn: ({ signal }) => getRecent(limit, signal),
    refetchInterval: 30 * SECOND,
  });

/** `services.stream.status` drives the offline / off-air banner. */
export const useHealth = () =>
  useQuery({
    queryKey: queryKeys.health,
    queryFn: ({ signal }) => getHealth(signal),
    refetchInterval: MINUTE,
  });

export const useStation = () =>
  useQuery({
    queryKey: queryKeys.station,
    queryFn: ({ signal }) => getStation(signal),
    staleTime: 24 * 60 * MINUTE,
  });

export const useShows = () =>
  useQuery({
    queryKey: queryKeys.shows,
    queryFn: ({ signal }) => getShows(signal),
    staleTime: 10 * MINUTE,
  });

// Schedule data refetches when the screen regains focus; the server sends an ETag so this is cheap.
export const useWeeklySchedule = (week?: string) =>
  useQuery({
    queryKey: queryKeys.weekly(week),
    queryFn: ({ signal }) => getWeeklySchedule(week, signal),
    staleTime: 5 * MINUTE,
    placeholderData: keepPreviousData,
  });

export const useSchedule = (from: string, to: string) =>
  useQuery({
    queryKey: queryKeys.schedule(from, to),
    queryFn: ({ signal }) => getSchedule(from, to, signal),
    staleTime: 5 * MINUTE,
    placeholderData: keepPreviousData,
  });

/** Disabled while the Archive tab is off (FEATURES.archive in src/config.ts). */
export const useArchives = () =>
  useQuery({
    queryKey: queryKeys.archives,
    queryFn: ({ signal }) => getArchives(signal),
    enabled: FEATURES.archive,
    staleTime: 5 * MINUTE,
  });

export const useShowArchives = (showId: string | undefined) =>
  useQuery({
    queryKey: queryKeys.showArchives(showId ?? ''),
    queryFn: ({ signal }) => getShowArchives(showId!, signal),
    enabled: FEATURES.archive && !!showId,
    staleTime: 5 * MINUTE,
  });
