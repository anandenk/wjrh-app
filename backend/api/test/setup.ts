import { applyD1Migrations } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, vi } from 'vitest';

const TABLES = ['schedule_snapshots', 'observations', 'health_checks', 'episodes', 'audit_log', 'rate_limits', 'join_outbox'];

beforeEach(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
  // D1 state persists across tests in this pool version; start each test clean.
  await env.DB.batch([
    ...TABLES.map((t) => env.DB.prepare(`DELETE FROM ${t}`)),
    env.DB.prepare(
      `UPDATE collector_state SET track_key = NULL, observation_id = NULL, last_polled_at = NULL, last_ok_at = NULL,
         source_updated_at = NULL, last_payload = NULL, last_error = NULL`,
    ),
  ]);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
