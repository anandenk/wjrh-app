// DEMO ONLY (EXPO_PUBLIC_DEMO_ARCHIVES=1). Sample archives for the real shows, so the Archive tab can be shown to the
// station board before any real recording exists. The show list, hosts and air times are the real ones (from the
// API); the recordings, their dates and the covers are made up. Nothing here comes from or goes to a server.
import type { ScheduleWeekly, Shows } from '@/api/types';
import { slotsForShow, stationClock, stationDate, type DayKey } from '@/screens/schedule/schedule-state';

import { demoShowInfo } from './demo-show-info';

export type DemoEpisode = {
  id: string;
  showId: string;
  showName: string;
  hosts: string;
  /** Calendar date in station time, YYYY-MM-DD. */
  date: string;
  /** "Sep 21, 2026", as in the design's sample history. */
  dateLabel: string;
  durationSeconds: number;
  /** Which placeholder cover (taken modulo the number of covers). */
  coverSlot: number;
};

export type DemoArchiveShow = {
  showId: string;
  name: string;
  hosts: string;
  genres: string;
  description: string;
  /** True when the description is a sample (the API and the calendar have none for this show). */
  descriptionIsSample: boolean;
  coverSlot: number;
  /** Newest first. */
  episodes: DemoEpisode[];
};

type ShowList = Shows['shows'];

const EPISODES_PER_SHOW = 3;
const DEFAULT_DURATION_SECONDS = 3600;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAY: Record<DayKey, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

/** The shows that get a tile: the active ones, in the API's order. */
export function activeShows(shows: ShowList): ShowList {
  return shows.filter((s) => s.active);
}

/** A show's placeholder cover slot, or null when it has no archive tile. */
export function coverSlotFor(shows: ShowList | undefined, showId: string | null | undefined): number | null {
  if (!shows || !showId) return null;
  const i = activeShows(shows).findIndex((s) => s.id === showId);
  return i < 0 ? null : i;
}

function hash(text: string): number {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

function weekdayOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function formatDateLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

/** The most recent date this weekday's broadcast has finished: today only once today's slot is over. */
function lastFinished(day: DayKey, endMin: number, now: Date): string {
  const today = stationDate(now);
  let back = (weekdayOf(today) - WEEKDAY[day] + 7) % 7;
  if (back === 0 && stationClock(now).minute < Math.min(endMin, 1440)) back = 7;
  return addDays(today, -back);
}

export function buildDemoArchive(opts: {
  shows: ShowList;
  weekly: ScheduleWeekly | undefined;
  now: Date;
}): DemoArchiveShow[] {
  return activeShows(opts.shows).map((show, coverSlot) => {
    const first = slotsForShow(opts.weekly, show.id)[0];
    // Air on the show's real day when this week's schedule has it, otherwise on a steady made-up day.
    const day: DayKey = first?.day ?? (['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const)[hash(show.id) % 7];
    const startMin = first?.slot.startMin ?? 12 * 60;
    let endMin = first?.slot.endMin ?? startMin + 60;
    if (endMin <= startMin) endMin += 1440;
    const seconds = (endMin - startMin) * 60;
    const durationSeconds = seconds >= 1800 && seconds <= 4 * 3600 ? seconds : DEFAULT_DURATION_SECONDS;

    const hosts = show.hostNames.length ? show.hostNames.join(', ') : (first?.slot.dj ?? '');
    const latest = lastFinished(day, endMin, opts.now);
    const episodes: DemoEpisode[] = Array.from({ length: EPISODES_PER_SHOW }, (_, i) => {
      const date = addDays(latest, -7 * i);
      return {
        id: `${show.id}-${date}`,
        showId: show.id,
        showName: show.name,
        hosts,
        date,
        dateLabel: formatDateLabel(date),
        durationSeconds,
        coverSlot,
      };
    });

    // What the API or the calendar really says wins; the sample only fills what is missing.
    const info = demoShowInfo(show.id, show.name);
    const realDescription = show.description ?? first?.slot.blurb ?? null;
    return {
      showId: show.id,
      name: show.name,
      hosts,
      genres: (show.genres.length ? show.genres.join(' · ') : first?.slot.genre) || info.genres,
      description: realDescription ?? info.description,
      descriptionIsSample: realDescription === null,
      coverSlot,
      episodes,
    };
  });
}

/** "1:02:03" or "2:03", as the design prints playback time. */
export function formatPlaybackTime(totalSeconds: number): string {
  const t = Math.max(0, Math.floor(Number.isFinite(totalSeconds) ? totalSeconds : 0));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** "1 hr", "1 hr 30 min" or "45 min". */
export function formatDuration(totalSeconds: number): string {
  const minutes = Math.round(totalSeconds / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}
