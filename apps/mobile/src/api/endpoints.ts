// One typed function per endpoint the listener app reads. See the screen -> endpoint table in
// docs/mobile-app/plan.md. There is deliberately nothing for /v1/admin/* or POST /v1/join here.
import { apiGet } from './client';
import type {
  ArchivesIndex,
  Health,
  NowPlaying,
  Recent,
  Schedule,
  ScheduleWeekly,
  ShowArchives,
  Shows,
  Station,
} from './types';

export const getHealth = (signal?: AbortSignal) => apiGet<Health>('/health', signal);
export const getNowPlaying = (signal?: AbortSignal) => apiGet<NowPlaying>('/now-playing', signal);
export const getRecent = (limit = 20, signal?: AbortSignal) =>
  apiGet<Recent>(`/recent?limit=${limit}`, signal);
export const getStation = (signal?: AbortSignal) => apiGet<Station>('/station', signal);
export const getShows = (signal?: AbortSignal) => apiGet<Shows>('/shows', signal);
/** Weekly template. `week` is a YYYY-MM-DD date inside the wanted week; omit for the current week. */
export const getWeeklySchedule = (week?: string, signal?: AbortSignal) =>
  apiGet<ScheduleWeekly>(week ? `/schedule/weekly?week=${week}` : '/schedule/weekly', signal);
/** Dated occurrences between two YYYY-MM-DD dates. */
export const getSchedule = (from: string, to: string, signal?: AbortSignal) =>
  apiGet<Schedule>(`/schedule?from=${from}&to=${to}`, signal);
export const getArchives = (signal?: AbortSignal) => apiGet<ArchivesIndex>('/archives', signal);
export const getShowArchives = (showId: string, signal?: AbortSignal) =>
  apiGet<ShowArchives>(`/shows/${encodeURIComponent(showId)}/archives`, signal);
