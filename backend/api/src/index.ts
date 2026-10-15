// WJRH application API. See docs/backend-proposal/api.md for the contract and
// backend/README.md for running it locally against the mock station.

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './env';
import { flag, num } from './env';
import { ApiError, errorResponse, jsonCached, safeEqual, ulid } from './http';
import { profileFor, publicStation, shows, showsUpdatedAt, station, type ShowProfile } from './content';
import {
  currentAndNext,
  isStale,
  loadSchedule,
  mondayOf,
  occurrencesBetween,
  refreshSchedule,
  weeklySchedule,
  type ShowOccurrence,
} from './schedule';
import { collectNowPlaying, fetchUpstream, metadataStale, recordObservation, type Track } from './nowplaying';
import { healthReport, runProbes } from './health';
import { join } from './join';
import {
  archiveIndex,
  deleteEpisode,
  expireEpisodes,
  getEpisode,
  listAll,
  listPublishedByShow,
  publicEpisode,
  adminEpisode,
  registerEpisode,
  updateEpisode,
  urlOnly,
} from './archives';
import { addDays, etDate, isoET, isoOrNull, parseDateParam, startOfEtDay } from './time';

type AppEnv = { Bindings: Env; Variables: { requestId: string; actor: string } };

const app = new Hono<AppEnv>();

app.use('*', async (c, next) => {
  c.set('requestId', c.req.header('cf-ray') ?? ulid());
  await next();
});

app.use('/v1/*', async (c, next) => {
  const allowed = (c.env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const admin = c.req.path.startsWith('/v1/admin/');
  return cors({
    origin: (origin) => (allowed.includes('*') ? '*' : allowed.includes(origin) ? origin : null),
    // Admin calls still need the bearer token; CORS only lets a browser review tool send it.
    allowMethods: admin ? ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'] : ['GET', 'HEAD', 'POST', 'OPTIONS'],
    allowHeaders: admin ? ['Content-Type', 'Authorization', 'X-Actor'] : ['Content-Type'],
    maxAge: 86400,
  })(c, next);
});

app.onError((err, c) => {
  if (err instanceof ApiError) return errorResponse(c, err.status, err.code, err.message);
  console.error(err);
  return errorResponse(c, 500, 'internal_error', 'Something went wrong.');
});

app.notFound((c) => errorResponse(c, 404, 'not_found', 'No such endpoint.'));

app.get('/', (c) =>
  c.json({
    name: 'WJRH API',
    version: 'v1',
    endpoints: [
      'GET /v1/health',
      'GET /v1/now-playing',
      'GET /v1/schedule?from=YYYY-MM-DD&to=YYYY-MM-DD',
      'GET /v1/schedule/weekly?week=YYYY-MM-DD',
      'GET /v1/shows',
      'GET /v1/shows/{showId}',
      'GET /v1/shows/{showId}/archives',
      'GET /v1/archives',
      'GET /v1/recent?limit=20&since=ISO-8601',
      'GET /v1/station',
      'POST /v1/join',
    ],
  }),
);

// ---------------------------------------------------------------- health

app.get('/v1/health', async (c) => jsonCached(c, await healthReport(c.env), 'no-store'));

// ---------------------------------------------------------------- now playing

function showSummary(o: ShowOccurrence | null) {
  if (!o) return null;
  return {
    id: o.showId,
    occurrenceId: o.id,
    name: o.title,
    hostNames: o.hostNames,
    startsAt: isoET(o.startMs),
    endsAt: isoET(o.endMs),
    hasProfile: o.hasProfile,
  };
}

// Per-isolate memo so a burst of listeners costs one upstream fetch and one
// collector write per window.
let nowPlayingMemo: { at: number; body: unknown } | null = null;

app.get('/v1/now-playing', async (c) => {
  const env = c.env;
  const now = Date.now();
  const ttl = num(env.NOW_PLAYING_CACHE_SECONDS, 10) * 1000;
  if (nowPlayingMemo && now >= nowPlayingMemo.at && now - nowPlayingMemo.at < ttl) return jsonCached(c, nowPlayingMemo.body, 'no-store');

  const [up, schedule] = await Promise.all([fetchUpstream(env), loadSchedule(env)]);
  const { current, next } = schedule ? currentAndNext(schedule, now) : { current: null, next: null };
  c.executionCtx.waitUntil(recordObservation(env, up, current, now).catch((e) => console.error('collector', e)));

  let track: Track | null = up.track;
  let sourceUpdatedAt = up.sourceUpdatedAt;
  let stale = up.ok ? metadataStale(env, sourceUpdatedAt, now) : true;
  if (!up.ok) {
    const last = await env.DB.prepare(`SELECT last_payload, source_updated_at, last_ok_at FROM collector_state WHERE id = 1`).first<{
      last_payload: string | null;
      source_updated_at: number | null;
      last_ok_at: number | null;
    }>();
    if (!last?.last_ok_at) throw new ApiError(503, 'metadata_unavailable', 'Now-playing information is unavailable.');
    track = last.last_payload ? JSON.parse(last.last_payload) : null;
    sourceUpdatedAt = last.source_updated_at;
    stale = true;
  }
  const body = {
    asOf: isoET(now),
    sourceUpdatedAt: isoOrNull(sourceUpdatedAt),
    stale,
    live: current !== null,
    automation: current === null,
    track,
    show: showSummary(current),
    nextShow: showSummary(next),
  };
  if (up.ok) nowPlayingMemo = { at: now, body };
  return jsonCached(c, body, 'no-store');
});

// ---------------------------------------------------------------- schedule

async function requireSchedule(env: Env) {
  const schedule = await loadSchedule(env);
  if (!schedule) throw new ApiError(503, 'schedule_unavailable', 'The schedule could not be loaded.');
  return schedule;
}

app.get('/v1/schedule', async (c) => {
  const today = etDate(Date.now());
  const from = c.req.query('from') ? parseDateParam(c.req.query('from')) : today;
  const to = c.req.query('to') ? parseDateParam(c.req.query('to')) : addDays(from ?? today, 6);
  if (!from || !to) throw new ApiError(400, 'invalid_request', 'from and to must be YYYY-MM-DD.');
  const fromMs = startOfEtDay(from);
  const toMs = startOfEtDay(addDays(to, 1)); // `to` is inclusive
  if (toMs <= fromMs || toMs - fromMs > 62 * 86_400_000) {
    throw new ApiError(400, 'invalid_request', 'Range must be 1 to 62 days.');
  }
  const schedule = await requireSchedule(c.env);
  return jsonCached(
    c,
    {
      timezone: 'America/New_York',
      generatedAt: isoET(schedule.fetchedAt),
      checkedAt: isoET(schedule.checkedAt),
      stale: isStale(c.env, schedule),
      source: 'google-calendar',
      from: isoET(fromMs),
      to: isoET(toMs),
      occurrences: occurrencesBetween(schedule, fromMs, toMs).map((o) => ({
        id: o.id,
        showId: o.showId,
        title: o.title,
        hostNames: o.hostNames,
        startsAt: isoET(o.startMs),
        endsAt: isoET(o.endMs),
        cancelled: o.cancelled,
        recurring: o.recurring,
        hasProfile: o.hasProfile,
      })),
    },
    'public, max-age=60, stale-if-error=86400',
  );
});

app.get('/v1/schedule/weekly', async (c) => {
  const week = c.req.query('week') ? parseDateParam(c.req.query('week')) : etDate(Date.now());
  if (!week) throw new ApiError(400, 'invalid_request', 'week must be YYYY-MM-DD.');
  const schedule = await requireSchedule(c.env);
  return jsonCached(c, weeklySchedule(schedule, mondayOf(week)), 'public, max-age=60, stale-if-error=86400');
});

// ---------------------------------------------------------------- shows

const publicShow = ({ aliases: _aliases, ...show }: ShowProfile) => show;

app.get('/v1/shows', (c) =>
  jsonCached(c, { updatedAt: showsUpdatedAt, shows: shows.map(publicShow) }, 'public, max-age=300'),
);

app.get('/v1/shows/:id', (c) => {
  const profile = profileFor(c.req.param('id'));
  if (!profile) throw new ApiError(404, 'not_found', 'No such show.');
  return jsonCached(c, { updatedAt: showsUpdatedAt, show: publicShow(profile) }, 'public, max-age=300');
});

app.get('/v1/shows/:id/archives', async (c) => {
  const profile = profileFor(c.req.param('id'));
  if (!profile) throw new ApiError(404, 'not_found', 'No such show.');
  const enabled = flag(c.env.ARCHIVES_ENABLED);
  const rows = enabled ? await listPublishedByShow(c.env, profile.id) : [];
  const store = urlOnly(c.env);
  return jsonCached(
    c,
    { showId: profile.id, enabled, episodes: rows.map((r) => publicEpisode(r, store)) },
    'public, max-age=60',
  );
});

app.get('/v1/archives', async (c) => {
  const enabled = flag(c.env.ARCHIVES_ENABLED);
  return jsonCached(
    c,
    { asOf: isoET(Date.now()), enabled, shows: enabled ? await archiveIndex(c.env) : [] },
    'public, max-age=60',
  );
});

// ---------------------------------------------------------------- recent

app.get('/v1/recent', async (c) => {
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') ?? '20', 10) || 20));
  const sinceParam = c.req.query('since');
  const since = sinceParam ? Date.parse(sinceParam) : 0;
  if (sinceParam && !Number.isFinite(since)) throw new ApiError(400, 'invalid_request', 'since must be ISO 8601.');
  const { results } = await c.env.DB.prepare(
    `SELECT id, title, artist, album, started_at, ended_at, show_id, occurrence_id FROM observations
     WHERE started_at > ?1 ORDER BY started_at DESC LIMIT ?2`,
  )
    .bind(since, limit)
    .all<{
      id: string;
      title: string | null;
      artist: string | null;
      album: string | null;
      started_at: number;
      ended_at: number | null;
      show_id: string | null;
      occurrence_id: string | null;
    }>();
  return jsonCached(
    c,
    {
      asOf: isoET(Date.now()),
      items: results.map((r) => ({
        id: r.id,
        type: 'track',
        title: r.title,
        artist: r.artist,
        album: r.album,
        startedAt: isoET(r.started_at),
        endedAt: isoOrNull(r.ended_at),
        showId: r.show_id,
        occurrenceId: r.occurrence_id,
      })),
    },
    'public, max-age=10',
  );
});

// ---------------------------------------------------------------- station + join

app.get('/v1/station', (c) => {
  const { $comment: _c, ...record } = station as typeof station & { $comment?: string };
  const body = publicStation(record); // no roster until the station approves it
  // Where listeners connect for live audio. It never goes through this API.
  return jsonCached(c, { ...body, listen: { streamUrl: c.env.STREAM_URL } }, 'public, max-age=300');
});

app.post('/v1/join', async (c) => {
  const body = await c.req.json().catch(() => null);
  const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? 'local';
  return jsonCached(c, await join(c.env, body, ip), 'no-store', 202);
});

// ---------------------------------------------------------------- admin

app.use('/v1/admin/*', async (c, next) => {
  if (c.req.method === 'OPTIONS') return next();
  const token = c.env.ADMIN_TOKEN;
  const header = c.req.header('authorization') ?? '';
  const supplied = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token || !supplied || !safeEqual(supplied, token)) {
    return errorResponse(c, 401, 'unauthorized', 'Staff credentials required.');
  }
  // In production /v1/admin/* also sits behind Cloudflare Access, which asserts the user.
  const actor = c.req.header('cf-access-authenticated-user-email') ?? c.req.header('x-actor')?.slice(0, 80) ?? 'token';
  c.set('actor', actor);
  if (!flag(c.env.ARCHIVES_ENABLED)) return errorResponse(c, 503, 'archives_disabled', 'Archives are disabled.');
  return next();
});

app.get('/v1/admin/archives', async (c) => c.json({ episodes: await listAll(c.env, c.req.query('status')) }));

app.post('/v1/admin/archives', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== 'object') throw new ApiError(400, 'invalid_request', 'JSON body required.');
  return c.json(await registerEpisode(c.env, body, c.get('actor')), 201);
});

app.get('/v1/admin/archives/:id', async (c) => c.json({ episode: adminEpisode(await getEpisode(c.env, c.req.param('id')), urlOnly(c.env)) }));

app.patch('/v1/admin/archives/:id', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== 'object') throw new ApiError(400, 'invalid_request', 'JSON body required.');
  return c.json({ episode: await updateEpisode(c.env, c.req.param('id'), body, c.get('actor')) });
});

app.delete('/v1/admin/archives/:id', async (c) => {
  await deleteEpisode(c.env, c.req.param('id'), c.get('actor'), 'delete');
  return c.body(null, 204);
});

app.get('/v1/admin/audit', async (c) => {
  const id = c.req.query('entityId');
  const { results } = id
    ? await c.env.DB.prepare(`SELECT * FROM audit_log WHERE entity_id = ?1 ORDER BY id`).bind(id).all()
    : await c.env.DB.prepare(`SELECT * FROM audit_log ORDER BY id DESC LIMIT 100`).all();
  return c.json({ entries: results.map((r: any) => ({ ...r, at: isoET(r.at), detail: r.detail ? JSON.parse(r.detail) : null })) });
});

// ---------------------------------------------------------------- scheduled jobs

export async function purge(env: Env, now = Date.now()) {
  const days = num(env.RECENT_RETENTION_DAYS, 30);
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM observations WHERE started_at < ?1`).bind(now - days * 86_400_000),
    env.DB.prepare(`DELETE FROM rate_limits WHERE window_start < ?1`).bind(now - 2 * 3600_000),
    env.DB.prepare(`DELETE FROM join_outbox WHERE created_at < ?1`).bind(now - 30 * 86_400_000),
  ]);
  if (flag(env.ARCHIVES_ENABLED)) await expireEpisodes(env, now);
}

export const JOBS: Record<string, (env: Env) => Promise<unknown>> = {
  '* * * * *': (env) => collectNowPlaying(env),
  '*/5 * * * *': (env) => runProbes(env),
  '*/15 * * * *': (env) => refreshSchedule(env),
  '17 8 * * *': (env) => purge(env),
};

export default {
  fetch: app.fetch,
  // Awaited (not waitUntil) so a triggered run has finished when the trigger returns,
  // which keeps `wrangler dev --test-scheduled` deterministic.
  async scheduled(event: ScheduledController, env: Env) {
    const job = JOBS[event.cron];
    if (!job) {
      console.warn(`no job for cron "${event.cron}"`);
      return;
    }
    const result = await job(env);
    console.log(`cron ${event.cron}`, JSON.stringify(result ?? 'done'));
  },
} satisfies ExportedHandler<Env>;

export { app };
