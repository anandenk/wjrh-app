// POST /v1/join — narrow adapter in front of whichever mailing-list provider the
// station chooses. Responses are deliberately generic: they never reveal
// whether an address is already subscribed.

import type { Env } from './env';
import { ApiError, sha256Hex, ulid } from './http';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WINDOW_MS = 3600_000;
const MAX_PER_WINDOW = 5;

export async function rateLimit(env: Env, key: string, now = Date.now()): Promise<boolean> {
  const windowStart = now - (now % WINDOW_MS);
  const row = await env.DB.prepare(
    `INSERT INTO rate_limits (key, window_start, count) VALUES (?1, ?2, 1)
     ON CONFLICT(key) DO UPDATE SET
       count = CASE WHEN window_start = ?2 THEN count + 1 ELSE 1 END,
       window_start = ?2
     RETURNING count`,
  )
    .bind(key, windowStart)
    .first<{ count: number }>();
  return (row?.count ?? 0) <= MAX_PER_WINDOW;
}

export async function join(env: Env, body: unknown, ip: string, now = Date.now()) {
  const provider = env.JOIN_PROVIDER || 'disabled';
  if (provider === 'disabled') throw new ApiError(503, 'join_unavailable', 'Sign-up is not connected yet.');

  const { email, source } = (body ?? {}) as { email?: unknown; source?: unknown };
  if (typeof email !== 'string' || email.length > 254 || !EMAIL_RE.test(email.trim())) {
    throw new ApiError(400, 'invalid_email', 'Enter a valid email address.');
  }
  // Rate-limit by a salted hash so raw IPs are never stored.
  const ipKey = `join:${(await sha256Hex(`${env.JOIN_SALT ?? ''}:${ip}`)).slice(0, 32)}`;
  if (!(await rateLimit(env, ipKey, now))) throw new ApiError(429, 'rate_limited', 'Too many requests. Try again later.');

  if (provider === 'log') {
    // Dev-only outbox standing in for the real provider.
    await env.DB.prepare(`INSERT INTO join_outbox (id, email, source, created_at) VALUES (?1, ?2, ?3, ?4)`)
      .bind(ulid(now), email.trim().toLowerCase(), typeof source === 'string' ? source.slice(0, 40) : null, now)
      .run();
  } else {
    throw new ApiError(503, 'join_unavailable', `Join provider "${provider}" is not implemented.`);
  }
  return { accepted: true, confirmationRequired: true };
}
