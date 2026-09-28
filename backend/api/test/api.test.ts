import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import { admin, audioStream, call, freezeAt, getJson, nowPlayingResponse, runCron, stubUpstreams } from './helpers';

// Friday 2 October 2026, 4:30 PM ET: Supercut (16:00–17:00) is on air.
const LIVE_SUPERCUT = '2026-10-02T20:30:00Z';

describe('schedule', () => {
  it('serves dated occurrences that match the contract', async () => {
    freezeAt(LIVE_SUPERCUT);
    stubUpstreams();
    const { res, body } = await getJson('/v1/schedule?from=2026-09-28&to=2026-10-04', 'schedule');
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('stale-if-error');
    expect(body.occurrences).toHaveLength(25); // 28 weekly slots minus the 3 one-off shows
    expect(body.occurrences[0]).toMatchObject({
      id: '2026-09-28T12:00:00-04:00_the-rodeo',
      showId: 'the-rodeo',
      hostNames: ['Josie', 'Rosetta'],
      cancelled: false,
    });
  });

  it('reproduces the legacy schedule.json byte-for-byte for the same week (parity with fetch_schedule.py)', async () => {
    stubUpstreams();
    // The fixture's one-off shows fell in the week of 14 September.
    const { body } = await getJson('/v1/schedule/weekly?week=2026-09-16', 'schedule-weekly');
    const legacy = JSON.parse(env.LEGACY_SCHEDULE).days;
    const strip = (days: Record<string, any[]>) =>
      Object.fromEntries(Object.entries(days).map(([k, v]) => [k, v.map(({ showId, occurrenceId, ...rest }) => rest)]));
    expect(strip(body.days)).toEqual(legacy);
  });

  it('keeps the last known-good schedule when the calendar breaks, and reports it', async () => {
    freezeAt(LIVE_SUPERCUT);
    const up = stubUpstreams();
    await runCron('*/15 * * * *');
    up.calendar = () => new Response('<html>Service Unavailable</html>', { status: 200 });
    expect(await runCron('*/15 * * * *')).toMatchObject({ status: 'rejected' });
    up.calendar = () => new Response('nope', { status: 503 });
    expect(await runCron('*/15 * * * *')).toMatchObject({ status: 'error' });

    const { body } = await getJson('/v1/schedule?from=2026-10-02&to=2026-10-02', 'schedule');
    expect(body.occurrences.map((o: any) => o.showId)).toContain('supercut');
    const { body: health } = await getJson('/v1/health', 'health');
    expect(health.services.schedule.lastError).toBe('calendar responded 503');
  });

  it('marks the schedule stale when refreshes stop succeeding', async () => {
    freezeAt('2026-10-02T12:00:00Z');
    const up = stubUpstreams();
    await runCron('*/15 * * * *');
    up.calendar = () => new Response('down', { status: 500 });
    freezeAt('2026-10-02T15:00:00Z');
    await runCron('*/15 * * * *');
    const { body } = await getJson('/v1/schedule?from=2026-10-02&to=2026-10-02', 'schedule');
    expect(body.stale).toBe(true);
  });

  it('rejects an empty calendar instead of wiping the schedule', async () => {
    const up = stubUpstreams();
    await runCron('*/15 * * * *');
    up.calendar = () => new Response('BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n');
    expect(await runCron('*/15 * * * *')).toMatchObject({ status: 'rejected', error: 'calendar contained no usable events' });
  });

  it('validates query parameters', async () => {
    stubUpstreams();
    expect((await getJson('/v1/schedule?from=2026-02-30', 'schedule')).res.status).toBe(400);
    expect((await getJson('/v1/schedule?from=2026-01-01&to=2026-06-01', 'schedule')).res.status).toBe(400);
  });
});

describe('now playing', () => {
  it('joins the track to the show on air', async () => {
    freezeAt(LIVE_SUPERCUT);
    stubUpstreams();
    const { body } = await getJson('/v1/now-playing', 'now-playing');
    expect(body).toMatchObject({
      live: true,
      automation: false,
      stale: false,
      track: { title: 'Cellophane Wing', artist: 'Miri Vale', album: null },
      show: { id: 'supercut', occurrenceId: '2026-10-02T16:00:00-04:00_supercut', hostNames: ['Reese'] },
      nextShow: { id: 'api-on-air' },
    });
  });

  it.each([
    ['literal Null', { ARTIST: 'Null', TITLE: 'Null' }],
    ['JSON null', { ARTIST: null, TITLE: null }],
    ['empty strings', { ARTIST: '', TITLE: '' }],
  ])('reports track: null for %s without failing', async (_label, np) => {
    stubUpstreams({ nowplaying: () => nowPlayingResponse(np) });
    const { res, body } = await getJson('/v1/now-playing', 'now-playing');
    expect(res.status).toBe(200);
    expect(body.track).toBeNull();
  });

  it('decodes URL-encoded metadata', async () => {
    stubUpstreams({ nowplaying: () => nowPlayingResponse({ ARTIST: 'Se%C3%B1or+%C3%91and%C3%BA', TITLE: 'Caf%C3%A9+%26+Cr%C3%A8me' }) });
    const { body } = await getJson('/v1/now-playing', 'now-playing');
    expect(body.track).toMatchObject({ title: 'Café & Crème', artist: 'Señor Ñandú' });
  });

  it('serves the last known track marked stale when the feed fails', async () => {
    const up = stubUpstreams();
    await getJson('/v1/now-playing', 'now-playing');
    up.nowplaying = () => new Response('{"nowplaying": {"ART', { status: 200 });
    const { body } = await getJson('/v1/now-playing', 'now-playing');
    expect(body).toMatchObject({ stale: true, track: { title: 'Cellophane Wing' } });
  });

  it('returns a 503 error envelope when the feed has never worked', async () => {
    stubUpstreams({ nowplaying: () => new Response('down', { status: 500 }) });
    const { res } = await getJson('/v1/now-playing', 'now-playing');
    expect(res.status).toBe(503);
  });

  it('flags metadata that has not changed for too long', async () => {
    stubUpstreams({ nowplaying: () => nowPlayingResponse({ ARTIST: 'A', TITLE: 'B' }, new Date(Date.now() - 3 * 3600_000)) });
    expect((await getJson('/v1/now-playing', 'now-playing')).body.stale).toBe(true);
  });
});

describe('recent history collector', () => {
  it('records each track once, closes it when the next begins, and ignores missing metadata', async () => {
    freezeAt(LIVE_SUPERCUT);
    const up = stubUpstreams();
    const feed = (np: Record<string, unknown>) => (up.nowplaying = () => nowPlayingResponse(np));

    feed({ ARTIST: 'Miri Vale', TITLE: 'Cellophane Wing' });
    await runCron('* * * * *');
    await runCron('* * * * *'); // same track again: no duplicate
    freezeAt('2026-10-02T20:34:00Z');
    feed({ ARTIST: 'Null', TITLE: 'Null' }); // DJ laptop: no entry, ends the previous track
    await runCron('* * * * *');
    freezeAt('2026-10-02T20:36:00Z');
    feed({ ARTIST: 'Ada Kray', TITLE: 'Hollowpoint Blue' });
    await runCron('* * * * *');
    await getJson('/v1/now-playing', 'now-playing'); // listener traffic also feeds the collector
    await getJson('/v1/now-playing', 'now-playing');

    const { body } = await getJson('/v1/recent?limit=10', 'recent');
    expect(body.items.map((i: any) => i.title)).toEqual(['Hollowpoint Blue', 'Cellophane Wing']);
    expect(body.items[1]).toMatchObject({ endedAt: '2026-10-02T16:34:00-04:00', showId: 'supercut' });
    expect(body.items[0]).toMatchObject({ endedAt: null, occurrenceId: '2026-10-02T16:00:00-04:00_supercut' });

    const since = await getJson(`/v1/recent?since=${encodeURIComponent('2026-10-02T16:35:00-04:00')}`, 'recent');
    expect(since.body.items).toHaveLength(1);
  });

  it('treats a short metadata gap inside one track as a single play', async () => {
    freezeAt(LIVE_SUPERCUT);
    const up = stubUpstreams();
    await runCron('* * * * *');
    freezeAt('2026-10-02T20:31:00Z');
    up.nowplaying = () => nowPlayingResponse({ ARTIST: 'Null', TITLE: 'Null' });
    await runCron('* * * * *');
    freezeAt('2026-10-02T20:32:00Z');
    up.nowplaying = () => nowPlayingResponse({ ARTIST: 'Miri Vale', TITLE: 'Cellophane Wing' });
    await runCron('* * * * *');
    const { body } = await getJson('/v1/recent', 'recent');
    expect(body.items).toHaveLength(1);
    expect(body.items[0].endedAt).toBeNull();
  });

  it('purges history older than the retention window', async () => {
    freezeAt('2026-08-01T12:00:00Z');
    stubUpstreams();
    await runCron('* * * * *');
    freezeAt('2026-10-02T12:00:00Z');
    await runCron('17 8 * * *');
    expect((await getJson('/v1/recent', 'recent')).body.items).toHaveLength(0);
  });
});

describe('health', () => {
  it('reports ok only when real audio bytes arrive', async () => {
    const up = stubUpstreams();
    await runCron('*/15 * * * *');
    await runCron('*/5 * * * *');
    let { body } = await getJson('/v1/health', 'health');
    expect(body.services.stream.status).toBe('ok');
    expect(body.services.schedule).toMatchObject({ status: 'ok', unmappedShows: [] });

    up.stream = () => audioStream(0); // HTTP 200, no audio
    await runCron('*/5 * * * *');
    ({ body } = await getJson('/v1/health', 'health'));
    expect(body.services.stream.status).toBe('down');
    expect(body.status).toBe('down');
  });

  it('lists calendar shows that have no profile', async () => {
    const up = stubUpstreams();
    up.calendar = () =>
      new Response(
        env.FIXTURE_ICS.replace('SUMMARY:Supercut - Reese', 'SUMMARY:Brand New Show - Reese'),
        { headers: { 'content-type': 'text/calendar' } },
      );
    await runCron('*/15 * * * *');
    const { body } = await getJson('/v1/health', 'health');
    expect(body.services.schedule.unmappedShows).toEqual(['Brand New Show']);
  });
});

describe('shows, station, CORS', () => {
  it('serves every station show with null editorial fields until supplied', async () => {
    const { body } = await getJson('/v1/shows', 'shows');
    expect(body.shows).toHaveLength(27);
    expect(body.shows.every((s: any) => s.description === null && s.hostBio === null)).toBe(true);
    expect((await getJson('/v1/shows/the-rodeo')).body.show.hostNames).toEqual(['Josie', 'Rosetta']);
    expect((await getJson('/v1/shows/nope', 'shows')).res.status).toBe(404);
  });

  it('serves the station roster', async () => {
    const { body } = await getJson('/v1/station', 'station');
    expect(body.approved).toBe(false);
    expect(body.listen.streamUrl).toBe(env.STREAM_URL);
  });

  it('allows only configured origins', async () => {
    const allowed = await call('/v1/shows', { headers: { Origin: 'https://www.wjrh.org' } });
    expect(allowed.headers.get('access-control-allow-origin')).toBe('https://www.wjrh.org');
    const denied = await call('/v1/shows', { headers: { Origin: 'https://evil.example' } });
    expect(denied.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('uses the error envelope for unknown routes', async () => {
    const { res } = await getJson('/v1/nope', 'error');
    expect(res.status).toBe(404);
  });
});

describe('join', () => {
  const post = (body: unknown, ip = '203.0.113.9') =>
    getJson('/v1/join', 'join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
      body: JSON.stringify(body),
    });

  it('accepts a valid address with a generic response', async () => {
    const { res, body } = await post({ email: 'Listener@Example.edu', source: 'listener-app' });
    expect(res.status).toBe(202);
    expect(body).toEqual({ accepted: true, confirmationRequired: true });
    const row = await env.DB.prepare('SELECT email FROM join_outbox').first<{ email: string }>();
    expect(row?.email).toBe('listener@example.edu');
  });

  it('rejects invalid addresses and rate-limits per client', async () => {
    expect((await post({ email: 'not-an-email' })).res.status).toBe(400);
    for (let i = 0; i < 5; i++) expect((await post({ email: `a${i}@example.edu` }, '198.51.100.1')).res.status).toBe(202);
    expect((await post({ email: 'a6@example.edu' }, '198.51.100.1')).res.status).toBe(429);
    expect((await post({ email: 'b@example.edu' }, '198.51.100.2')).res.status).toBe(202);
  });

  it('never stores raw IP addresses', async () => {
    await post({ email: 'x@example.edu' }, '192.0.2.44');
    const { results } = await env.DB.prepare('SELECT key FROM rate_limits').all<{ key: string }>();
    expect(results.some((r) => r.key.includes('192.0.2.44'))).toBe(false);
  });
});

describe('archives', () => {
  async function registerAndUpload(up: ReturnType<typeof stubUpstreams>, showId = 'supercut') {
    const { res, body } = await getJson(
      '/v1/admin/archives',
      undefined,
      admin('POST', { showId, recordedAt: '2026-10-02T16:00:00-04:00', occurrenceId: `2026-10-02T16:00:00-04:00_${showId}` }),
    );
    expect(res.status).toBe(201);
    expect(body.upload.url).toContain('X-Amz-Signature=');
    // The recorder PUTs straight to storage with the presigned URL.
    up.s3.set(body.episode.objectKey, { bytes: 57_600_000, type: 'audio/mpeg' });
    return body.episode.id as string;
  }

  it('requires the staff token', async () => {
    stubUpstreams();
    expect((await call('/v1/admin/archives')).status).toBe(401);
    expect((await call('/v1/admin/archives', { headers: { Authorization: 'Bearer wrong' } })).status).toBe(401);
  });

  it('runs register → upload → review → publish → unpublish, auditing every step', async () => {
    const up = stubUpstreams();
    const id = await registerAndUpload(up);

    // Nothing is public until staff publish.
    expect((await getJson('/v1/shows/supercut/archives', 'show-archives')).body.episodes).toHaveLength(0);
    expect((await getJson(`/v1/admin/archives/${id}`, undefined, admin('PATCH', { status: 'published' }))).res.status).toBe(409);

    let r = await getJson(`/v1/admin/archives/${id}`, undefined, admin('PATCH', { status: 'pending_review' }));
    expect(r.body.episode).toMatchObject({ status: 'pending_review', bytes: 57_600_000 });
    expect((await getJson('/v1/shows/supercut/archives', 'show-archives')).body.episodes).toHaveLength(0);

    r = await getJson(`/v1/admin/archives/${id}`, undefined, admin('PATCH', { status: 'published' }));
    expect(r.res.status).toBe(409); // duration required first
    await getJson(`/v1/admin/archives/${id}`, undefined, admin('PATCH', { durationSeconds: 3598, title: 'Supercut, Oct 2' }));
    r = await getJson(`/v1/admin/archives/${id}`, undefined, admin('PATCH', { status: 'published' }));
    expect(r.body.episode.status).toBe('published');

    const pub = await getJson('/v1/shows/supercut/archives', 'show-archives');
    expect(pub.body.episodes[0]).toMatchObject({
      id,
      durationSeconds: 3598,
      audioUrl: expect.stringMatching(/^http:\/\/127\.0\.0\.1:9000\/wjrh-archive\/archives\/supercut\//),
    });
    const index = await getJson('/v1/archives', 'archives-index');
    expect(index.body.shows).toEqual([expect.objectContaining({ showId: 'supercut', episodeCount: 1 })]);

    await getJson(`/v1/admin/archives/${id}`, undefined, admin('PATCH', { status: 'unpublished' }));
    expect((await getJson('/v1/shows/supercut/archives', 'show-archives')).body.episodes).toHaveLength(0);

    const audit = await getJson(`/v1/admin/audit?entityId=${id}`, undefined, admin('GET'));
    expect(audit.body.entries.map((e: any) => e.action)).toEqual([
      'register',
      'status:pending_review',
      'edit',
      'status:published',
      'status:unpublished',
    ]);
    expect(audit.body.entries.every((e: any) => e.actor === 'vitest')).toBe(true);
  });

  it('refuses review when the upload never arrived', async () => {
    stubUpstreams();
    const { body } = await getJson(
      '/v1/admin/archives',
      undefined,
      admin('POST', { showId: 'supercut', recordedAt: '2026-10-02T16:00:00-04:00' }),
    );
    const r = await getJson(`/v1/admin/archives/${body.episode.id}`, undefined, admin('PATCH', { status: 'pending_review' }));
    expect(r.res.status).toBe(409);
    expect(r.body.error.code).toBe('upload_missing');
  });

  it('rejects unknown shows and non-audio types', async () => {
    stubUpstreams();
    const bad = await getJson('/v1/admin/archives', undefined, admin('POST', { showId: 'no-such-show', recordedAt: '2026-10-02T16:00:00-04:00' }));
    expect(bad.res.status).toBe(422);
    const type = await getJson('/v1/admin/archives', undefined, admin('POST', { showId: 'supercut', recordedAt: '2026-10-02T16:00:00-04:00', mimeType: 'text/html' }));
    expect(type.res.status).toBe(400);
  });

  it('deletes the stored object with the record, keeping the audit trail', async () => {
    const up = stubUpstreams();
    const id = await registerAndUpload(up);
    const key = [...up.s3.keys()][0];
    expect((await call(`/v1/admin/archives/${id}`, admin('DELETE'))).status).toBe(204);
    expect(up.s3.has(key)).toBe(false);
    expect((await call(`/v1/admin/archives/${id}`, admin('GET'))).status).toBe(404);
    const audit = await getJson(`/v1/admin/audit?entityId=${id}`, undefined, admin('GET'));
    expect(audit.body.entries.at(-1).action).toBe('delete');
  });

  it('expires episodes past the retention window', async () => {
    freezeAt('2026-10-02T21:00:00Z');
    const up = stubUpstreams();
    const id = await registerAndUpload(up);
    freezeAt('2026-10-20T12:00:00Z'); // > 14 days after recording
    await runCron('17 8 * * *');
    expect((await call(`/v1/admin/archives/${id}`, admin('GET'))).status).toBe(404);
    expect(up.s3.size).toBe(0);
  });
});

describe('test harness', () => {
  it('runs with now-playing caching disabled', () => {
    expect(env.NOW_PLAYING_CACHE_SECONDS).toBe('0');
  });
});
