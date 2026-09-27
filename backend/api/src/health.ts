// Operational probes. /v1/health reports the stored results so a listener
// request never waits on (or hammers) the upstreams.

import type { Env } from './env';
import { flag } from './env';
import { fetchWithTimeout } from './http';
import { isoOrNull } from './time';
import { fetchUpstream, metadataStale } from './nowplaying';
import { isStale, lastScheduleError, loadSchedule, unmappedShows } from './schedule';

export type Status = 'ok' | 'degraded' | 'down' | 'disabled';

interface ProbeResult {
  status: Status;
  latencyMs: number | null;
  detail: Record<string, unknown>;
}

const MIN_AUDIO_BYTES = 8 * 1024;

/**
 * An HTTP 200 is not proof of a working stream: read real audio bytes, then
 * hang up. Latency is time to the first byte.
 */
export async function probeStream(env: Env): Promise<ProbeResult> {
  const started = Date.now();
  try {
    const res = await fetchWithTimeout(env.STREAM_URL, { headers: { 'Icy-MetaData': '0', 'User-Agent': 'WJRH-health/0.1' } }, 10_000);
    const type = res.headers.get('content-type') ?? '';
    if (!res.ok || !res.body) return { status: 'down', latencyMs: null, detail: { httpStatus: res.status } };
    const reader = res.body.getReader();
    let bytes = 0;
    let firstByteMs: number | null = null;
    const deadline = started + 6000;
    try {
      while (bytes < MIN_AUDIO_BYTES && Date.now() < deadline) {
        const chunk = await Promise.race([
          reader.read(),
          new Promise<{ done: true; value: undefined }>((resolve) =>
            setTimeout(() => resolve({ done: true, value: undefined }), Math.max(0, deadline - Date.now())),
          ),
        ]);
        if (chunk.done) break;
        if (firstByteMs === null) firstByteMs = Date.now() - started;
        bytes += chunk.value.byteLength;
      }
    } finally {
      reader.cancel().catch(() => {});
    }
    const audio = /^audio\//.test(type);
    const status: Status = bytes >= MIN_AUDIO_BYTES && audio ? 'ok' : bytes > 0 ? 'degraded' : 'down';
    return { status, latencyMs: firstByteMs, detail: { httpStatus: res.status, contentType: type, bytes } };
  } catch (err) {
    return { status: 'down', latencyMs: null, detail: { error: (err as Error).message } };
  }
}

export async function probeMetadata(env: Env): Promise<ProbeResult> {
  const started = Date.now();
  const up = await fetchUpstream(env);
  const latencyMs = Date.now() - started;
  if (!up.ok) return { status: 'down', latencyMs, detail: { error: up.error } };
  const stale = metadataStale(env, up.sourceUpdatedAt);
  return {
    status: stale ? 'degraded' : 'ok',
    latencyMs,
    detail: {
      freshAt: up.sourceUpdatedAt,
      hasTrack: up.track !== null,
      albumSupplied: Boolean(up.track?.album),
      stale,
    },
  };
}

export async function runProbes(env: Env, now = Date.now()): Promise<void> {
  const [stream, metadata] = await Promise.all([probeStream(env), probeMetadata(env)]);
  const upsert = (service: string, r: ProbeResult) =>
    env.DB.prepare(
      `INSERT INTO health_checks (service, status, checked_at, latency_ms, detail) VALUES (?1, ?2, ?3, ?4, ?5)
       ON CONFLICT(service) DO UPDATE SET status = ?2, checked_at = ?3, latency_ms = ?4, detail = ?5`,
    ).bind(service, r.status, now, r.latencyMs, JSON.stringify(r.detail));
  await env.DB.batch([upsert('stream', stream), upsert('metadata', metadata)]);
}

const RANK: Record<Status, number> = { ok: 0, disabled: 0, degraded: 1, down: 2 };

export async function healthReport(env: Env, now = Date.now()) {
  let rows = (await env.DB.prepare(`SELECT service, status, checked_at, latency_ms, detail FROM health_checks`).all<{
    service: string;
    status: Status;
    checked_at: number;
    latency_ms: number | null;
    detail: string;
  }>()).results;
  if (!rows.length) {
    await runProbes(env, now);
    rows = (await env.DB.prepare(`SELECT service, status, checked_at, latency_ms, detail FROM health_checks`).all<any>()).results;
  }
  const probe = (name: string) => {
    const r = rows.find((x) => x.service === name);
    if (!r) return { status: 'down' as Status, checkedAt: null, latencyMs: null, detail: {} as Record<string, any> };
    // A probe that has not run for 15 minutes means the cron itself is broken.
    const stale = now - r.checked_at > 15 * 60_000;
    return {
      status: (stale && r.status === 'ok' ? 'degraded' : r.status) as Status,
      checkedAt: r.checked_at,
      latencyMs: r.latency_ms,
      detail: JSON.parse(r.detail) as Record<string, any>,
      probeStale: stale,
    };
  };
  const stream = probe('stream');
  const metadata = probe('metadata');

  const schedule = await loadSchedule(env, { refreshIfMissing: false });
  const lastError = await lastScheduleError(env);
  const scheduleStatus: Status = !schedule ? 'down' : isStale(env, schedule, now) ? 'degraded' : 'ok';
  const unmapped = schedule ? unmappedShows(schedule, now) : [];

  let archives: { status: Status; stuckUploads?: number; published?: number } = { status: 'disabled' };
  if (flag(env.ARCHIVES_ENABLED)) {
    const counts = await env.DB.prepare(
      `SELECT SUM(status = 'published') AS published,
              SUM(status = 'uploading' AND created_at < ?1) AS stuck
       FROM episodes`,
    )
      .bind(now - 3 * 3600_000)
      .first<{ published: number | null; stuck: number | null }>();
    const stuck = counts?.stuck ?? 0;
    archives = { status: stuck ? 'degraded' : 'ok', stuckUploads: stuck, published: counts?.published ?? 0 };
  }

  const services = {
    stream: { status: stream.status, checkedAt: isoOrNull(stream.checkedAt), latencyMs: stream.latencyMs, bytesRead: stream.detail.bytes ?? null },
    metadata: {
      status: metadata.status,
      checkedAt: isoOrNull(metadata.checkedAt),
      freshAt: isoOrNull(metadata.detail.freshAt),
      albumSupplied: metadata.detail.albumSupplied ?? false,
    },
    schedule: {
      status: scheduleStatus,
      generatedAt: isoOrNull(schedule?.fetchedAt),
      checkedAt: isoOrNull(schedule?.checkedAt),
      lastError: lastError && (!schedule || lastError.at > schedule.checkedAt) ? lastError.error : null,
      warnings: schedule?.warnings ?? [],
      unmappedShows: unmapped,
    },
    archives,
  };
  const worst = Object.values(services).reduce((acc, s) => (RANK[s.status] > RANK[acc] ? s.status : acc), 'ok' as Status);
  return { status: worst === 'disabled' ? 'ok' : worst, checkedAt: isoOrNull(now), services };
}
