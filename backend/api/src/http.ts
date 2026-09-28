import type { Context } from 'hono';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export function requestId(c: Context): string {
  return c.req.header('cf-ray') ?? (c.get('requestId' as never) as string | undefined) ?? 'local';
}

export function errorResponse(c: Context, status: number, code: string, message: string): Response {
  return c.json({ error: { code, message, requestId: requestId(c) } }, status as 400);
}

/** JSON with an explicit cache policy (see docs/backend-proposal/api.md "Cache guidance"). */
export function jsonCached(c: Context, body: unknown, cacheControl: string, status = 200): Response {
  c.header('Cache-Control', cacheControl);
  return c.json(body, status as 200);
}

// ---- ULIDs: sortable, collision-resistant IDs without a dependency ----

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function ulid(now = Date.now()): string {
  let time = '';
  let t = now;
  for (let i = 0; i < 10; i++) {
    time = CROCKFORD[t % 32] + time;
    t = Math.floor(t / 32);
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let rand = '';
  for (let i = 0; i < 16; i++) rand += CROCKFORD[bytes[i] % 32];
  return time + rand;
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time string comparison for bearer tokens. */
export function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

/** fetch with a hard timeout; upstream hangs must not hang the API. */
export async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 8000): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(ms) });
}
