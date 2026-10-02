import { API_BASE, USE_FIXTURES } from '@/config';

import { fixtures, showArchivesFixture } from './fixtures';
import type { ApiErrorBody } from './types';

/** The server answered with an error (the `{ error: { code, message, requestId } }` envelope). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly requestId: string | null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** No usable answer: offline, DNS, timeout, or a body that is not JSON. */
export class NetworkError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'NetworkError';
  }
}

const TIMEOUT_MS = 10_000;

function isErrorBody(x: unknown): x is ApiErrorBody {
  const e = (x as ApiErrorBody | null)?.error;
  return typeof e?.code === 'string' && typeof e?.message === 'string';
}

function fixtureFor(path: string): unknown {
  const bare = path.split('?')[0];
  if (/^\/shows\/[^/]+\/archives$/.test(bare)) return showArchivesFixture;
  if (bare in fixtures) return fixtures[bare];
  throw new NetworkError(`No fixture for ${bare}`);
}

/**
 * GET `/v1<path>` and return the parsed JSON as `T`. Throws `ApiError` for an error envelope
 * and `NetworkError` when there is no usable response. `path` starts with "/", e.g. "/recent?limit=20".
 */
export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  // The listener app never calls admin endpoints (docs/mobile-app/plan.md, "Rules").
  if (path.startsWith('/admin')) throw new Error('Admin endpoints must not be called from the app');

  if (USE_FIXTURES) return fixtureFor(path) as T;

  if (!API_BASE) throw new NetworkError('EXPO_PUBLIC_API_BASE is not set for this build');

  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), TIMEOUT_MS);
  signal?.addEventListener('abort', () => timeout.abort());

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/v1${path}`, {
      headers: { Accept: 'application/json' },
      signal: timeout.signal,
    });
  } catch (cause) {
    throw new NetworkError(timeout.signal.aborted ? 'Request timed out' : 'Network request failed', cause);
  } finally {
    clearTimeout(timer);
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch (cause) {
    if (res.ok) throw new NetworkError('Response was not JSON', cause);
    throw new ApiError(res.status, 'bad_response', `HTTP ${res.status}`, null);
  }

  if (!res.ok) {
    if (isErrorBody(body)) {
      throw new ApiError(res.status, body.error.code, body.error.message, body.error.requestId ?? null);
    }
    throw new ApiError(res.status, 'bad_response', `HTTP ${res.status}`, null);
  }
  return body as T;
}
