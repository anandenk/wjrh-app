// Normalizes the existing nowplaying.wjrh.org feed and records play history.

import type { Env } from './env';
import { num } from './env';
import { fetchWithTimeout, ulid } from './http';
import { currentAndNext, loadSchedule, type ShowOccurrence } from './schedule';

export interface Track {
  title: string | null;
  artist: string | null;
  album: string | null;
  artworkUrl: string | null;
}

export interface Upstream {
  ok: boolean;
  track: Track | null;
  sourceUpdatedAt: number | null;
  raw: string | null;
  error: string | null;
}

/**
 * Port of cleanMeta in wjrh-app/app.js. The feed URL-encodes values and reports
 * the literal string "Null" when a DJ streams from their own laptop.
 */
export function cleanMeta(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  let s = String(v);
  try {
    s = decodeURIComponent(s.replace(/\+/g, ' '));
  } catch {
    /* leave as-is */
  }
  s = s.trim();
  if (!s || /^null$/i.test(s) || /^unknown$/i.test(s) || s === '-') return null;
  return s;
}

export function normalizePayload(payload: unknown): Track | null {
  if (!payload || typeof payload !== 'object') return null;
  const outer = payload as Record<string, unknown>;
  const np = (outer.nowplaying && typeof outer.nowplaying === 'object' ? outer.nowplaying : outer) as Record<string, unknown>;
  const title = cleanMeta(np.TITLE ?? np.title);
  const artist = cleanMeta(np.ARTIST ?? np.artist);
  const album = cleanMeta(np.ALBUM ?? np.album);
  if (!title && !artist) return null;
  // Artwork needs a documented, rights-cleared source before it is ever filled.
  return { title, artist, album, artworkUrl: null };
}

export async function fetchUpstream(env: Env): Promise<Upstream> {
  try {
    const res = await fetchWithTimeout(env.METADATA_URL, { headers: { 'User-Agent': 'WJRH-api/0.1' } }, 5000);
    if (!res.ok) return { ok: false, track: null, sourceUpdatedAt: null, raw: null, error: `metadata responded ${res.status}` };
    const raw = await res.text();
    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      return { ok: false, track: null, sourceUpdatedAt: null, raw: raw.slice(0, 500), error: 'metadata was not valid JSON' };
    }
    const lm = res.headers.get('last-modified');
    const parsed = lm ? Date.parse(lm) : NaN;
    return {
      ok: true,
      track: normalizePayload(payload),
      sourceUpdatedAt: Number.isFinite(parsed) ? parsed : null,
      raw: raw.slice(0, 2000),
      error: null,
    };
  } catch (err) {
    const e = err as Error;
    return { ok: false, track: null, sourceUpdatedAt: null, raw: null, error: e.name === 'TimeoutError' ? 'metadata timed out' : e.message };
  }
}

const REOPEN_WINDOW_MS = 5 * 60_000;

const trackKey = (t: Track | null) => (t ? `${(t.title ?? '').toLowerCase()}|${(t.artist ?? '').toLowerCase()}` : null);

/**
 * Fold one upstream observation into play history. Safe to call concurrently
 * (cron + listener traffic): only the caller that flips track_key inserts a row.
 */
export async function recordObservation(
  env: Env,
  up: Upstream,
  occurrence: ShowOccurrence | null,
  now = Date.now(),
): Promise<void> {
  if (!up.ok) {
    await env.DB.prepare(`UPDATE collector_state SET last_polled_at = ?1, last_error = ?2 WHERE id = 1`)
      .bind(now, up.error)
      .run();
    return;
  }
  const key = trackKey(up.track);
  const state = await env.DB.prepare(`SELECT track_key, observation_id FROM collector_state WHERE id = 1`).first<{
    track_key: string | null;
    observation_id: string | null;
  }>();

  const common = [now, up.sourceUpdatedAt, JSON.stringify(up.track)] as const;
  if (state && state.track_key === key) {
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE collector_state SET last_polled_at = ?1, last_ok_at = ?1, source_updated_at = ?2, last_payload = ?3, last_error = NULL WHERE id = 1`,
      ).bind(...common),
      ...(state.observation_id
        ? [env.DB.prepare(`UPDATE observations SET last_seen_at = ?1 WHERE id = ?2`).bind(now, state.observation_id)]
        : []),
    ]);
    return;
  }

  const id = up.track ? ulid(now) : null;
  const claim = await env.DB.prepare(
    `UPDATE collector_state SET track_key = ?4, observation_id = ?5, last_polled_at = ?1, last_ok_at = ?1,
       source_updated_at = ?2, last_payload = ?3, last_error = NULL
     WHERE id = 1 AND track_key IS ?6`,
  )
    .bind(...common, key, id, state?.track_key ?? null)
    .run();
  if (!claim.meta.changes) return; // another invocation recorded this change first

  const statements = [];
  if (state?.observation_id) {
    statements.push(
      env.DB.prepare(`UPDATE observations SET ended_at = ?1 WHERE id = ?2 AND ended_at IS NULL`).bind(now, state.observation_id),
    );
  }
  if (up.track && id) {
    // A metadata blip (e.g. one "Null" poll) between two sightings of the same
    // track is one play, not two: reopen the previous entry instead.
    const previous = await env.DB.prepare(
      `SELECT id, title, artist, ended_at FROM observations ORDER BY started_at DESC LIMIT 1`,
    ).first<{ id: string; title: string | null; artist: string | null; ended_at: number | null }>();
    if (
      previous &&
      previous.ended_at !== null &&
      now - previous.ended_at < REOPEN_WINDOW_MS &&
      trackKey({ title: previous.title, artist: previous.artist, album: null, artworkUrl: null }) === key
    ) {
      statements.push(
        env.DB.prepare(`UPDATE observations SET ended_at = NULL, last_seen_at = ?1 WHERE id = ?2`).bind(now, previous.id),
        env.DB.prepare(`UPDATE collector_state SET observation_id = ?1 WHERE id = 1`).bind(previous.id),
      );
      await env.DB.batch(statements);
      return;
    }
    // Use the publisher's Last-Modified when it is plausible; never claim more
    // precision than we observed otherwise.
    const started =
      up.sourceUpdatedAt && up.sourceUpdatedAt <= now && now - up.sourceUpdatedAt < 10 * 60_000 ? up.sourceUpdatedAt : now;
    statements.push(
      env.DB.prepare(
        `INSERT INTO observations (id, title, artist, album, started_at, last_seen_at, show_id, occurrence_id, raw)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
      ).bind(
        id,
        up.track.title,
        up.track.artist,
        up.track.album,
        started,
        now,
        occurrence?.showId ?? null,
        occurrence?.id ?? null,
        up.raw,
      ),
    );
  }
  if (statements.length) await env.DB.batch(statements);
}

export async function collectNowPlaying(env: Env, now = Date.now()): Promise<Upstream> {
  const [up, schedule] = await Promise.all([fetchUpstream(env), loadSchedule(env)]);
  const occurrence = schedule ? currentAndNext(schedule, now).current : null;
  await recordObservation(env, up, occurrence, now);
  return up;
}

export function metadataStale(env: Env, sourceUpdatedAt: number | null, now = Date.now()): boolean {
  if (sourceUpdatedAt === null) return false;
  return now - sourceUpdatedAt > num(env.METADATA_STALE_MINUTES, 45) * 60_000;
}
