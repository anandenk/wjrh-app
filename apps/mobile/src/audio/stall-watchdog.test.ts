import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isStalled, madeProgress, STALL_LIMITS_MS, stallLimitMs } from './stall-watchdog';

test('limits start above a normal start (~7 s), grow, and cap', () => {
  assert.ok(STALL_LIMITS_MS[0] > 7_000 * 2);
  assert.deepEqual([...STALL_LIMITS_MS], [...STALL_LIMITS_MS].sort((a, b) => a - b));
  assert.equal(stallLimitMs(0), 15_000);
  assert.equal(stallLimitMs(1), 20_000);
  assert.equal(stallLimitMs(2), 30_000);
  assert.equal(stallLimitMs(50), 30_000); // capped
  assert.equal(stallLimitMs(-3), 15_000); // never negative
});

test('isStalled: only strictly after the limit', () => {
  assert.equal(isStalled(10_000, 0, 0), false);
  assert.equal(isStalled(15_000, 0, 0), false); // exactly at the limit is not yet a stall
  assert.equal(isStalled(15_001, 0, 0), true);
  assert.equal(isStalled(15_001, 0, 1), false); // the second attempt waits longer
  assert.equal(isStalled(20_001, 0, 1), true);
});

const ok = { playing: true, isBuffering: false, error: null, currentTime: 5 };

test('madeProgress: needs audible playback whose position moved', () => {
  assert.equal(madeProgress(4, ok), true);
  assert.equal(madeProgress(5, ok), false); // position frozen
  assert.equal(madeProgress(-1, ok), true); // first sample after a reconnect
  assert.equal(madeProgress(4, { ...ok, playing: false }), false);
  assert.equal(madeProgress(4, { ...ok, isBuffering: true }), false);
  assert.equal(madeProgress(4, { ...ok, error: 'Could not connect' }), false);
});
