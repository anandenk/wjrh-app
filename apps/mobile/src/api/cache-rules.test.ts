import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { PersistedClient } from '@tanstack/react-query-persist-client';

import { CACHE_BUSTER, isFromEarlierRun, pruneSaved, shouldSave } from './cache-rules';
import { SCHEMA_VERSION } from './schema-version';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = Date.UTC(2026, 9, 8, 18, 0, 0);

test('saves station, schedule, show list and now-playing only', () => {
  assert.equal(shouldSave(['station']), true);
  assert.equal(shouldSave(['schedule', 'weekly', 'current']), true);
  assert.equal(shouldSave(['schedule', 'weekly', '2026-W41']), true);
  assert.equal(shouldSave(['shows']), true);
  assert.equal(shouldSave(['now-playing']), true);
});

test('does not save health, recent tracks, archives or unknown keys', () => {
  assert.equal(shouldSave(['health']), false);
  assert.equal(shouldSave(['recent', 20]), false);
  assert.equal(shouldSave(['archives']), false);
  assert.equal(shouldSave(['shows', 'supercut', 'archives']), false);
  assert.equal(shouldSave([]), false);
  assert.equal(shouldSave(['something-new']), false);
});

test('the cache key includes the schema hash', () => {
  assert.ok(CACHE_BUSTER.endsWith(SCHEMA_VERSION));
  assert.match(SCHEMA_VERSION, /^[0-9a-f]{12}$/);
});

const query = (queryKey: unknown[], ageMs: number) => ({
  queryKey,
  queryHash: JSON.stringify(queryKey),
  state: { data: {}, dataUpdatedAt: NOW - ageMs },
});
const saved = (queries: ReturnType<typeof query>[]): PersistedClient =>
  ({
    timestamp: NOW,
    buster: CACHE_BUSTER,
    clientState: { mutations: [{ mutationKey: ['x'] }], queries },
  }) as unknown as PersistedClient;

test('restoring drops answers that are too old for their kind', () => {
  const out = pruneSaved(
    saved([
      query(['station'], 6 * DAY), // kept: station info changes rarely
      query(['schedule', 'weekly', 'current'], 8 * DAY), // dropped: older than a week
      query(['now-playing'], 30 * 60 * 1000), // kept: half an hour is fine as "last known"
      query(['now-playing'], 2 * HOUR), // dropped: an old track is not what is playing
    ]),
    NOW,
  );
  assert.deepEqual(
    out.clientState.queries.map((q) => [q.queryKey[0], NOW - q.state.dataUpdatedAt]),
    [
      ['station', 6 * DAY],
      ['now-playing', 30 * 60 * 1000],
    ],
  );
});

test('restoring drops kinds we never save, and any saved mutations', () => {
  const out = pruneSaved(saved([query(['health'], 0), query(['recent', 20], 0), query(['shows'], 0)]), NOW);
  assert.deepEqual(
    out.clientState.queries.map((q) => q.queryKey[0]),
    ['shows'],
  );
  assert.deepEqual(out.clientState.mutations, []);
});

test('an answer is from an earlier run if it is older than the app start', () => {
  assert.equal(isFromEarlierRun(NOW - 1, NOW), true);
  assert.equal(isFromEarlierRun(NOW, NOW), false);
  assert.equal(isFromEarlierRun(NOW + 5_000, NOW), false);
  assert.equal(isFromEarlierRun(0, NOW), true); // never fetched: nothing from this run
});

test('restoring turns an answer saved after a failed refresh back into a plain success', () => {
  const failed = {
    queryKey: ['now-playing'],
    queryHash: '["now-playing"]',
    state: {
      data: { id: 1 },
      dataUpdatedAt: NOW - 10 * 60 * 1000,
      status: 'error',
      error: {}, // an Error is saved as an empty object
      errorUpdateCount: 3,
      fetchFailureCount: 3,
      fetchFailureReason: {},
    },
  };
  const out = pruneSaved(saved([failed as unknown as ReturnType<typeof query>]), NOW);
  assert.equal(out.clientState.queries.length, 1);
  const state = out.clientState.queries[0].state;
  assert.equal(state.status, 'success');
  assert.equal(state.error, null);
  assert.equal(state.fetchFailureCount, 0);
  assert.equal(state.dataUpdatedAt, NOW - 10 * 60 * 1000); // keeps its real age
  assert.deepEqual(state.data, { id: 1 });
});

test('restoring drops a saved query that has no data', () => {
  const noData = { queryKey: ['station'], queryHash: '["station"]', state: { dataUpdatedAt: 0, status: 'pending' } };
  assert.equal(pruneSaved(saved([noData as unknown as ReturnType<typeof query>]), NOW).clientState.queries.length, 0);
});
