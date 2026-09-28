// Archive episodes: public read endpoints, the staff review workflow, and retention.
//
//   recorder ── POST /v1/admin/archives ──> episode 'uploading' + presigned PUT URL
//   recorder ── PUT <presigned> ──────────> object storage
//   recorder ── PATCH status=pending_review (verified against storage)
//   staff ───── PATCH status=published / unpublished, DELETE
//
// Mixcloud episodes (provider 'mixcloud') skip the upload: the recorder has already
// uploaded to Mixcloud, so registering verifies the cloudcast and goes straight to
// 'pending_review'. Listeners play them through Mixcloud's widget (see mixcloud.ts).
//
// Only 'published' episodes are ever visible to listeners.

import type { Env } from './env';
import { num } from './env';
import { ApiError, ulid } from './http';
import { profileFor } from './content';
import { archiveStore } from './storage';
import { isoOrNull } from './time';
import { lookupCloudcast, mixcloudLinks } from './mixcloud';

export type EpisodeStatus = 'uploading' | 'pending_review' | 'published' | 'unpublished';
export type EpisodeProvider = 'storage' | 'mixcloud';

export interface EpisodeRow {
  id: string;
  show_id: string;
  occurrence_id: string | null;
  status: EpisodeStatus;
  object_key: string; // storage object key, or the Mixcloud cloudcast key
  provider: EpisodeProvider;
  mime_type: string;
  bytes: number | null;
  duration_seconds: number | null;
  recorded_at: number;
  published_at: number | null;
  title: string | null;
  description: string | null;
  created_at: number;
  updated_at: number;
  created_by: string | null;
}

const TRANSITIONS: Record<EpisodeStatus, EpisodeStatus[]> = {
  uploading: ['pending_review'],
  pending_review: ['published', 'unpublished'],
  published: ['unpublished'],
  unpublished: ['published'],
};

const ALLOWED_MIME = new Set(['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg']);
const EXT: Record<string, string> = { 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/aac': 'aac', 'audio/ogg': 'ogg' };

/** How an episode's media is addressed, without needing storage credentials. */
export interface MediaLinks {
  publicUrl(key: string): string;
  mixcloud(key: string): ReturnType<typeof mixcloudLinks>;
}

export function publicEpisode(row: EpisodeRow, links: MediaLinks) {
  const profile = profileFor(row.show_id);
  const onMixcloud = row.provider === 'mixcloud';
  return {
    id: row.id,
    showId: row.show_id,
    occurrenceId: row.occurrence_id,
    title: row.title ?? profile?.name ?? row.show_id,
    recordedAt: isoOrNull(row.recorded_at),
    publishedAt: isoOrNull(row.published_at),
    durationSeconds: row.duration_seconds,
    provider: row.provider,
    // Self-hosted audio plays in our own player; Mixcloud audio only plays in Mixcloud's widget.
    audioUrl: onMixcloud ? null : links.publicUrl(row.object_key),
    mimeType: onMixcloud ? null : row.mime_type,
    byteRangeSupported: !onMixcloud,
    mixcloud: onMixcloud ? links.mixcloud(row.object_key) : null,
    artwork: profile?.artwork ?? null,
    description: row.description,
  };
}

export function adminEpisode(row: EpisodeRow, links: MediaLinks) {
  return {
    ...publicEpisode(row, links),
    status: row.status,
    objectKey: row.object_key,
    bytes: row.bytes,
    createdAt: isoOrNull(row.created_at),
    updatedAt: isoOrNull(row.updated_at),
    createdBy: row.created_by,
  };
}

/** Media links without requiring storage credentials (listing never touches S3). */
export function urlOnly(env: Env): MediaLinks {
  return {
    publicUrl: (key) => `${env.MEDIA_BASE_URL.replace(/\/$/, '')}/${key}`,
    mixcloud: (key) => mixcloudLinks(env, key),
  };
}

export async function audit(env: Env, actor: string, action: string, entityId: string, detail: unknown, now = Date.now()) {
  await env.DB.prepare(`INSERT INTO audit_log (at, actor, action, entity, entity_id, detail) VALUES (?1, ?2, ?3, 'episode', ?4, ?5)`)
    .bind(now, actor, action, entityId, JSON.stringify(detail ?? null))
    .run();
}

export async function listPublishedByShow(env: Env, showId: string, limit = 50) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM episodes WHERE show_id = ?1 AND status = 'published' ORDER BY recorded_at DESC LIMIT ?2`,
  )
    .bind(showId, limit)
    .all<EpisodeRow>();
  return results;
}

export async function archiveIndex(env: Env) {
  const { results } = await env.DB.prepare(
    `SELECT show_id, COUNT(*) AS n, MAX(recorded_at) AS latest FROM episodes
     WHERE status = 'published' GROUP BY show_id ORDER BY latest DESC`,
  ).all<{ show_id: string; n: number; latest: number }>();
  return results.map((r) => {
    const profile = profileFor(r.show_id);
    return {
      showId: r.show_id,
      name: profile?.name ?? r.show_id,
      episodeCount: r.n,
      latestRecordedAt: isoOrNull(r.latest),
      artwork: profile?.artwork ?? null,
    };
  });
}

// ---- admin ----

function str(v: unknown, max: number): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'string') throw new ApiError(400, 'invalid_request', 'Expected a string.');
  const t = v.trim();
  if (t.length > max) throw new ApiError(400, 'invalid_request', `Text longer than ${max} characters.`);
  return t || null;
}

function duration(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'number' || !Number.isInteger(v) || v <= 0 || v > 12 * 3600) {
    throw new ApiError(400, 'invalid_request', 'durationSeconds must be a positive integer (max 12 hours).');
  }
  return v;
}

export async function registerEpisode(env: Env, body: Record<string, unknown>, actor: string, now = Date.now()) {
  const requested = str(body.showId, 80);
  if (!requested || !/^[a-z0-9-]+$/.test(requested)) throw new ApiError(400, 'invalid_request', 'showId is required.');
  const profile = profileFor(requested);
  if (!profile) throw new ApiError(422, 'unknown_show', `No show profile "${requested}" in content/shows.json.`);
  const showId = profile.id;
  const mime = str(body.mimeType, 40) ?? 'audio/mpeg';
  if (!ALLOWED_MIME.has(mime)) throw new ApiError(400, 'invalid_request', `Unsupported mimeType ${mime}.`);
  const recordedAt = typeof body.recordedAt === 'string' ? Date.parse(body.recordedAt) : NaN;
  if (!Number.isFinite(recordedAt)) throw new ApiError(400, 'invalid_request', 'recordedAt must be an ISO 8601 timestamp.');
  const provider = (body.provider ?? 'storage') as EpisodeProvider;
  if (provider !== 'storage' && provider !== 'mixcloud') throw new ApiError(400, 'invalid_request', 'provider must be "storage" or "mixcloud".');
  if (provider === 'mixcloud') return registerMixcloudEpisode(env, body, showId, recordedAt, actor, now);

  const store = archiveStore(env);
  const id = ulid(now);
  const key = `archives/${showId}/${id}.${EXT[mime]}`;
  const row: EpisodeRow = {
    id,
    show_id: showId,
    occurrence_id: str(body.occurrenceId, 120),
    status: 'uploading',
    object_key: key,
    provider: 'storage',
    mime_type: mime,
    bytes: null,
    duration_seconds: duration(body.durationSeconds),
    recorded_at: recordedAt,
    published_at: null,
    title: str(body.title, 120),
    description: str(body.description, 1000),
    created_at: now,
    updated_at: now,
    created_by: actor,
  };
  await insertEpisode(env, row);
  await audit(env, actor, 'register', id, { showId, occurrenceId: row.occurrence_id }, now);
  const expires = 3600;
  return {
    episode: adminEpisode(row, urlOnly(env)),
    upload: {
      method: 'PUT',
      url: await store.presignPut(key, mime, expires),
      headers: { 'Content-Type': mime },
      expiresAt: isoOrNull(now + expires * 1000),
    },
  };
}

async function registerMixcloudEpisode(
  env: Env,
  body: Record<string, unknown>,
  showId: string,
  recordedAt: number,
  actor: string,
  now: number,
) {
  const key = str(body.mixcloudKey, 200);
  if (!key) throw new ApiError(400, 'invalid_request', 'mixcloudKey is required for Mixcloud episodes.');
  const existing = await env.DB.prepare(`SELECT id FROM episodes WHERE object_key = ?1`).bind(key).first();
  if (existing) throw new ApiError(409, 'already_registered', `${key} is already registered.`);
  // Trust Mixcloud, not the uploader: the cloudcast must exist.
  const cloudcast = await lookupCloudcast(env, key);
  const id = ulid(now);
  const row: EpisodeRow = {
    id,
    show_id: showId,
    occurrence_id: str(body.occurrenceId, 120),
    status: 'pending_review',
    object_key: cloudcast.key,
    provider: 'mixcloud',
    mime_type: 'audio/mpeg',
    bytes: null,
    duration_seconds: duration(body.durationSeconds) ?? cloudcast.audioLength,
    recorded_at: recordedAt,
    published_at: null,
    title: str(body.title, 120),
    description: str(body.description, 1000),
    created_at: now,
    updated_at: now,
    created_by: actor,
  };
  await insertEpisode(env, row);
  await audit(env, actor, 'register', id, { showId, occurrenceId: row.occurrence_id, mixcloudKey: cloudcast.key }, now);
  return { episode: adminEpisode(row, urlOnly(env)), upload: null };
}

async function insertEpisode(env: Env, row: EpisodeRow) {
  await env.DB.prepare(
    `INSERT INTO episodes (id, show_id, occurrence_id, status, object_key, provider, mime_type, bytes, duration_seconds,
       recorded_at, published_at, title, description, created_at, updated_at, created_by)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)`,
  )
    .bind(
      row.id, row.show_id, row.occurrence_id, row.status, row.object_key, row.provider, row.mime_type, row.bytes,
      row.duration_seconds, row.recorded_at, row.published_at, row.title, row.description, row.created_at,
      row.updated_at, row.created_by,
    )
    .run();
}

export async function getEpisode(env: Env, id: string): Promise<EpisodeRow> {
  const row = await env.DB.prepare(`SELECT * FROM episodes WHERE id = ?1`).bind(id).first<EpisodeRow>();
  if (!row) throw new ApiError(404, 'not_found', 'No such episode.');
  return row;
}

export async function updateEpisode(env: Env, id: string, body: Record<string, unknown>, actor: string, now = Date.now()) {
  const row = await getEpisode(env, id);
  const next = { ...row };
  const changes: Record<string, unknown> = {};

  for (const field of ['title', 'description'] as const) {
    if (field in body) {
      next[field] = str(body[field], field === 'title' ? 120 : 1000);
      changes[field] = next[field];
    }
  }
  if ('durationSeconds' in body) {
    next.duration_seconds = duration(body.durationSeconds);
    changes.durationSeconds = next.duration_seconds;
  }
  if ('status' in body && body.status !== row.status) {
    const target = body.status as EpisodeStatus;
    if (!TRANSITIONS[row.status]?.includes(target)) {
      throw new ApiError(409, 'invalid_transition', `Cannot move an episode from ${row.status} to ${String(target)}.`);
    }
    if (target === 'pending_review') {
      // Trust storage, not the uploader: the object must exist and be audio.
      const head = await archiveStore(env).head(row.object_key);
      if (!head || head.bytes === 0) throw new ApiError(409, 'upload_missing', 'The audio file has not been uploaded.');
      if (!head.contentType.startsWith('audio/')) {
        throw new ApiError(409, 'upload_invalid', `Uploaded object has type ${head.contentType || 'unknown'}.`);
      }
      next.bytes = head.bytes;
    }
    if (target === 'published') {
      if (!next.duration_seconds) throw new ApiError(409, 'duration_required', 'Set durationSeconds before publishing.');
      next.published_at = now;
    }
    next.status = target;
    changes.status = target;
  }
  if (!Object.keys(changes).length) throw new ApiError(400, 'invalid_request', 'Nothing to change.');
  next.updated_at = now;
  await env.DB.prepare(
    `UPDATE episodes SET status = ?2, title = ?3, description = ?4, duration_seconds = ?5, bytes = ?6,
       published_at = ?7, updated_at = ?8 WHERE id = ?1`,
  )
    .bind(id, next.status, next.title, next.description, next.duration_seconds, next.bytes, next.published_at, now)
    .run();
  await audit(env, actor, changes.status ? `status:${String(changes.status)}` : 'edit', id, changes, now);
  return adminEpisode(next, urlOnly(env));
}

export async function deleteEpisode(env: Env, id: string, actor: string, reason: string, now = Date.now()) {
  const row = await getEpisode(env, id);
  // Mixcloud uploads are removed in Mixcloud's own dashboard; the audit entry says so.
  if (row.provider === 'storage') await archiveStore(env).remove(row.object_key);
  await env.DB.prepare(`DELETE FROM episodes WHERE id = ?1`).bind(id).run();
  await audit(
    env,
    actor,
    reason,
    id,
    {
      showId: row.show_id,
      objectKey: row.object_key,
      status: row.status,
      provider: row.provider,
      ...(row.provider === 'mixcloud' ? { remoteRemoval: 'manual: delete it in the Mixcloud dashboard' } : {}),
    },
    now,
  );
}

export async function listAll(env: Env, status: string | undefined) {
  const { results } = status
    ? await env.DB.prepare(`SELECT * FROM episodes WHERE status = ?1 ORDER BY recorded_at DESC LIMIT 200`).bind(status).all<EpisodeRow>()
    : await env.DB.prepare(`SELECT * FROM episodes ORDER BY recorded_at DESC LIMIT 200`).all<EpisodeRow>();
  return results.map((r) => adminEpisode(r, urlOnly(env)));
}

/**
 * Retention: remove self-hosted episodes recorded before the policy window, with an
 * audit record. Mixcloud episodes are kept until staff delete them (decision 002).
 */
export async function expireEpisodes(env: Env, now = Date.now()): Promise<number> {
  const days = num(env.ARCHIVE_RETENTION_DAYS, 0);
  if (days <= 0) return 0;
  const { results } = await env.DB.prepare(`SELECT id FROM episodes WHERE provider = 'storage' AND recorded_at < ?1 LIMIT 50`)
    .bind(now - days * 86_400_000)
    .all<{ id: string }>();
  for (const { id } of results) await deleteEpisode(env, id, 'retention', 'expired', now);
  return results.length;
}
