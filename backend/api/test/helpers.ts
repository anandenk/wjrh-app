import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { Validator } from '@cfworker/json-schema';
import { expect, vi } from 'vitest';
import worker from '../src/index';

import archivesIndex from '../../schemas/archives-index.schema.json';
import error from '../../schemas/error.schema.json';
import health from '../../schemas/health.schema.json';
import joinSchema from '../../schemas/join.schema.json';
import nowPlaying from '../../schemas/now-playing.schema.json';
import recent from '../../schemas/recent.schema.json';
import schedule from '../../schemas/schedule.schema.json';
import scheduleWeekly from '../../schemas/schedule-weekly.schema.json';
import showArchives from '../../schemas/show-archives.schema.json';
import shows from '../../schemas/shows.schema.json';
import station from '../../schemas/station.schema.json';

const SCHEMAS = {
  'archives-index': archivesIndex,
  error,
  health,
  join: joinSchema,
  'now-playing': nowPlaying,
  recent,
  schedule,
  'schedule-weekly': scheduleWeekly,
  'show-archives': showArchives,
  shows,
  station,
} as const;

export type SchemaName = keyof typeof SCHEMAS;

export function expectSchema(name: SchemaName, body: unknown) {
  const result = new Validator(SCHEMAS[name] as object, '7', false).validate(body);
  if (!result.valid) {
    throw new Error(`${name} schema violation:\n${JSON.stringify(result.errors.slice(0, 5), null, 2)}\n${JSON.stringify(body).slice(0, 800)}`);
  }
}

export async function call(path: string, init?: RequestInit): Promise<Response> {
  const ctx = createExecutionContext();
  const res = await worker.fetch(new Request(`http://api.test${path}`, init), env, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

export async function getJson(path: string, schema?: SchemaName, init?: RequestInit) {
  const res = await call(path, init);
  const body = res.status === 204 ? null : await res.json<any>();
  if (schema) expectSchema(res.ok ? schema : 'error', body);
  return { res, body };
}

export const admin = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json', 'X-Actor': 'vitest' },
  body: body === undefined ? undefined : JSON.stringify(body),
});

export async function runCron(cron: string) {
  const { JOBS } = await import('../src/index');
  return JOBS[cron](env);
}

/** Freeze Date only (timers stay real, so probes and timeouts still work). */
export function freezeAt(iso: string) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(iso));
}

// ---- upstream stubs (the Worker runs in the test isolate, so stubbing global fetch reaches it) ----

export interface Upstreams {
  calendar: () => Response;
  nowplaying: () => Response;
  stream: () => Response;
  s3: Map<string, { bytes: number; type: string }>;
  /** Cloudcasts on the fake Mixcloud, by key ("/wjrh/show-name/"). */
  mixcloud: Map<string, { name: string; audio_length: number }>;
  calls: string[];
}

export function nowPlayingResponse(np: Record<string, unknown>, lastModified = new Date()) {
  return new Response(JSON.stringify({ nowplaying: np }), {
    headers: { 'content-type': 'binary/octet-stream', 'last-modified': lastModified.toUTCString() },
  });
}

export function audioStream(bytes: number) {
  return new Response(
    new ReadableStream({
      start(controller) {
        if (bytes) controller.enqueue(new Uint8Array(bytes));
        controller.close();
      },
    }),
    { headers: { 'content-type': 'audio/mpeg', 'icy-br': '128' } },
  );
}

export function stubUpstreams(overrides: Partial<Omit<Upstreams, 's3' | 'mixcloud' | 'calls'>> = {}): Upstreams {
  const up: Upstreams = {
    calendar: () => new Response(env.FIXTURE_ICS, { headers: { 'content-type': 'text/calendar' } }),
    nowplaying: () => nowPlayingResponse({ ARTIST: 'Miri Vale', TITLE: 'Cellophane Wing' }),
    stream: () => audioStream(16 * 1024),
    s3: new Map(),
    mixcloud: new Map(),
    calls: [],
    ...overrides,
  };
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input as RequestInfo, init);
    const url = new URL(req.url);
    up.calls.push(`${req.method} ${url.origin}${url.pathname}`);
    if (req.url.startsWith(env.CALENDAR_URL)) return up.calendar();
    if (req.url.startsWith(env.METADATA_URL)) return up.nowplaying();
    if (req.url.startsWith(env.STREAM_URL)) return up.stream();
    if (env.MIXCLOUD_API_BASE && req.url.startsWith(env.MIXCLOUD_API_BASE)) {
      const cast = up.mixcloud.get(url.pathname);
      return cast
        ? Response.json({ key: url.pathname, url: `https://www.mixcloud.com${url.pathname}`, ...cast })
        : Response.json({ error: { type: 'NotFound' } }, { status: 404 });
    }
    if (req.url.startsWith(env.S3_ENDPOINT)) {
      const key = decodeURIComponent(url.pathname.replace(`/${env.S3_BUCKET}/`, ''));
      const obj = up.s3.get(key);
      if (req.method === 'HEAD') {
        return obj
          ? new Response(null, { headers: { 'content-length': String(obj.bytes), 'content-type': obj.type } })
          : new Response(null, { status: 404 });
      }
      if (req.method === 'DELETE') {
        up.s3.delete(key);
        return new Response(null, { status: 204 });
      }
    }
    return new Response('unexpected upstream in test', { status: 599 });
  });
  return up;
}
