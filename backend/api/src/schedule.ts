import type { Env } from './env';
import { num } from './env';
import { expand, initials, parseCalendar, shorten, splitSummary, type IcsEvent } from './ics';
import { hostNamesFromDj, resolveShow } from './content';
import { fetchWithTimeout, sha256Hex } from './http';
import {
  addDays,
  DAY_KEYS,
  etDate,
  isoET,
  startOfEtDay,
  toWall,
  weekday,
  type CivilDate,
} from './time';

export interface ScheduleState {
  id: number;
  fetchedAt: number;
  checkedAt: number;
  events: IcsEvent[];
  warnings: string[];
}

export interface ShowOccurrence {
  id: string;
  showId: string;
  title: string;
  dj: string;
  hostNames: string[];
  description: string;
  uid: string;
  startMs: number;
  endMs: number;
  cancelled: boolean;
  recurring: boolean;
  hasProfile: boolean;
}

export type RefreshOutcome =
  | { status: 'ok' | 'unchanged'; eventCount: number; warnings: string[] }
  | { status: 'rejected' | 'error'; error: string };

const DAY_MS = 86_400_000;

async function recordFailure(env: Env, status: 'rejected' | 'error', error: string, now: number) {
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO schedule_snapshots (fetched_at, checked_at, status, error) VALUES (?1, ?1, ?2, ?3)`,
    ).bind(now, status, error.slice(0, 500)),
    env.DB.prepare(
      `DELETE FROM schedule_snapshots WHERE status != 'ok' AND id NOT IN
         (SELECT id FROM schedule_snapshots WHERE status != 'ok' ORDER BY id DESC LIMIT 20)`,
    ),
  ]);
}

/**
 * Fetch the calendar, validate it, and store it as the current schedule.
 * Failures never replace the last known-good snapshot.
 */
export async function refreshSchedule(env: Env, now = Date.now()): Promise<RefreshOutcome> {
  let text: string;
  try {
    const res = await fetchWithTimeout(env.CALENDAR_URL, { headers: { 'User-Agent': 'WJRH-api/0.1' } }, 20_000);
    if (!res.ok) throw new Error(`calendar responded ${res.status}`);
    text = await res.text();
  } catch (err) {
    const error = (err as Error).message || 'calendar fetch failed';
    await recordFailure(env, 'error', error, now);
    return { status: 'error', error };
  }

  let events: IcsEvent[];
  let warnings: string[];
  try {
    ({ events, warnings } = parseCalendar(text));
    if (!events.length) throw new Error('calendar contained no usable events');
  } catch (err) {
    const error = (err as Error).message;
    await recordFailure(env, 'rejected', error, now);
    return { status: 'rejected', error };
  }

  // Advisory checks: reported through /v1/health, never a reason to reject.
  const horizon = expand(events, now, now + 14 * DAY_MS);
  warnings.push(...horizon.warnings);
  const live = horizon.occurrences.filter((o) => !o.cancelled);
  if (!live.length) warnings.push('no occurrences in the next 14 days');
  for (let i = 1; i < live.length; i++) {
    if (live[i].startMs < live[i - 1].endMs) {
      warnings.push(`overlap: "${live[i - 1].summary}" and "${live[i].summary}" at ${isoET(live[i].startMs)}`);
    }
  }

  const hash = await sha256Hex(text.replace(/^DTSTAMP:.*$/gm, ''));
  const latest = await env.DB.prepare(
    `SELECT id, source_hash FROM schedule_snapshots WHERE status = 'ok' ORDER BY id DESC LIMIT 1`,
  ).first<{ id: number; source_hash: string }>();
  if (latest?.source_hash === hash) {
    await env.DB.prepare(`UPDATE schedule_snapshots SET checked_at = ?1, warnings = ?2 WHERE id = ?3`)
      .bind(now, JSON.stringify(warnings), latest.id)
      .run();
    return { status: 'unchanged', eventCount: events.length, warnings };
  }
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO schedule_snapshots (fetched_at, checked_at, status, source_hash, event_count, events_json, warnings)
       VALUES (?1, ?1, 'ok', ?2, ?3, ?4, ?5)`,
    ).bind(now, hash, events.length, JSON.stringify(events), JSON.stringify(warnings)),
    env.DB.prepare(
      `DELETE FROM schedule_snapshots WHERE status = 'ok' AND id NOT IN
         (SELECT id FROM schedule_snapshots WHERE status = 'ok' ORDER BY id DESC LIMIT 10)`,
    ),
  ]);
  return { status: 'ok', eventCount: events.length, warnings };
}

let memo: { id: number; events: IcsEvent[] } | null = null;

export async function loadSchedule(env: Env, { refreshIfMissing = true } = {}): Promise<ScheduleState | null> {
  const row = await env.DB.prepare(
    `SELECT id, fetched_at, checked_at, events_json, warnings FROM schedule_snapshots
     WHERE status = 'ok' ORDER BY id DESC LIMIT 1`,
  ).first<{ id: number; fetched_at: number; checked_at: number; events_json: string; warnings: string | null }>();
  if (!row) {
    if (!refreshIfMissing) return null;
    await refreshSchedule(env);
    return loadSchedule(env, { refreshIfMissing: false });
  }
  if (!memo || memo.id !== row.id) memo = { id: row.id, events: JSON.parse(row.events_json) };
  return {
    id: row.id,
    fetchedAt: row.fetched_at,
    checkedAt: row.checked_at,
    events: memo.events,
    warnings: row.warnings ? JSON.parse(row.warnings) : [],
  };
}

export async function lastScheduleError(env: Env): Promise<{ at: number; error: string } | null> {
  const row = await env.DB.prepare(
    `SELECT fetched_at, error FROM schedule_snapshots WHERE status != 'ok' ORDER BY id DESC LIMIT 1`,
  ).first<{ fetched_at: number; error: string }>();
  return row ? { at: row.fetched_at, error: row.error } : null;
}

export function isStale(env: Env, state: ScheduleState, now = Date.now()): boolean {
  return now - state.checkedAt > num(env.SCHEDULE_STALE_MINUTES, 90) * 60_000;
}

export function occurrencesBetween(state: ScheduleState, fromMs: number, toMs: number): ShowOccurrence[] {
  return expand(state.events, fromMs, toMs).occurrences.map((o) => {
    const { show, dj } = splitSummary(o.summary);
    const resolved = resolveShow(show);
    return {
      id: `${isoET(o.startMs)}_${resolved.id}`,
      showId: resolved.id,
      title: show,
      dj,
      hostNames: hostNamesFromDj(dj),
      description: o.description,
      uid: o.uid,
      startMs: o.startMs,
      endMs: o.endMs,
      cancelled: o.cancelled,
      recurring: o.recurring,
      hasProfile: resolved.profile !== null,
    };
  });
}

export function currentAndNext(state: ScheduleState, now = Date.now()) {
  const window = occurrencesBetween(state, now - DAY_MS, now + 8 * DAY_MS).filter((o) => !o.cancelled);
  const current = window.find((o) => o.startMs <= now && now < o.endMs) ?? null;
  const next = window.find((o) => o.startMs > now) ?? null;
  return { current, next };
}

/** Every calendar show name that has no profile in content/shows.json. */
export function unmappedShows(state: ScheduleState, now = Date.now()): string[] {
  const names = new Set<string>();
  for (const o of occurrencesBetween(state, now - 7 * DAY_MS, now + 28 * DAY_MS)) {
    if (!o.hasProfile) names.add(o.title);
  }
  return [...names].sort();
}

export function mondayOf(date: CivilDate): CivilDate {
  return addDays(date, -weekday(date));
}

const hhmm = (ms: number) => {
  const w = toWall(ms);
  return { text: `${String(w.h).padStart(2, '0')}:${String(w.mi).padStart(2, '0')}`, min: w.h * 60 + w.mi };
};

/**
 * The legacy wjrh-app/schedule.json shape, derived from one real week of dated
 * occurrences. Lets the current PWA switch data source without a rewrite.
 */
export function weeklySchedule(state: ScheduleState, weekStart: CivilDate, profileLookup = resolveShow) {
  const from = startOfEtDay(weekStart);
  const to = startOfEtDay(addDays(weekStart, 7));
  const days: Record<string, unknown[]> = Object.fromEntries(DAY_KEYS.map((k) => [k, []]));
  for (const o of occurrencesBetween(state, from, to)) {
    if (o.cancelled || o.startMs < from) continue;
    const day = DAY_KEYS[weekday(etDate(o.startMs))];
    const start = hhmm(o.startMs);
    const end = hhmm(o.endMs);
    const profile = profileLookup(o.title).profile;
    const slot: Record<string, unknown> = {
      id: `${day}-${start.text.replace(':', '')}-${o.showId}`,
      uid: o.uid,
      startsAt: start.text,
      endsAt: end.text,
      startMin: start.min,
      endMin: end.min,
      show: o.title,
      dj: o.dj,
      // The calendar has no genre field; the first description line is the genre
      // (as in fetch_schedule.py) unless the station supplied one.
      genre: profile?.genres.length
        ? profile.genres.join(', ')
        : o.description
          ? shorten(o.description.split('\n')[0])
          : '',
      description: o.description,
      host: { name: o.dj, initials: initials(o.dj), bio: profile?.hostBio ?? '' },
      recurring: o.recurring,
      showId: o.showId,
      occurrenceId: o.id,
    };
    if (profile?.description) slot.blurb = profile.description;
    days[day].push(slot);
  }
  return {
    tz: 'America/New_York',
    generatedAt: isoET(state.fetchedAt),
    checkedAt: isoET(state.checkedAt),
    source: 'Google Calendar (public ICS) via WJRH API',
    weekOf: `${weekStart.y}-${String(weekStart.mo).padStart(2, '0')}-${String(weekStart.d).padStart(2, '0')}`,
    days,
  };
}
