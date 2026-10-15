import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { DemoEpisode } from './demo-data';
import { initialPlayerState, playerReducer, type DemoPlayerAction, type DemoPlayerState } from './demo-player-state';

const episode: DemoEpisode = {
  id: 'show-2026-10-14',
  showId: 'show',
  showName: 'Show',
  hosts: 'Host',
  date: '2026-10-14',
  dateLabel: 'Oct 14, 2026',
  durationSeconds: 100,
  coverSlot: 0,
};

const run = (actions: DemoPlayerAction[], from: DemoPlayerState = initialPlayerState) =>
  actions.reduce(playerReducer, from);

const playing = (actions: DemoPlayerAction[] = []) =>
  run([{ type: 'select', episode }, { type: 'loaded' }, ...actions]);

test('selecting an episode loads it from the start, then plays', () => {
  const loading = run([{ type: 'select', episode }]);
  assert.deepEqual(loading, { episode, status: 'loading', position: 0 });
  assert.equal(playerReducer(loading, { type: 'tick' }).position, 0, 'the clock does not run while loading');
  assert.equal(playerReducer(loading, { type: 'loaded' }).status, 'playing');
});

test('time passes only while playing', () => {
  assert.equal(playing([{ type: 'tick' }, { type: 'tick' }]).position, 2);
  assert.equal(playing([{ type: 'tick' }, { type: 'toggle' }, { type: 'tick' }]).position, 1);
});

test('toggle pauses and resumes at the same spot', () => {
  const paused = playing([{ type: 'tick' }, { type: 'toggle' }]);
  assert.equal(paused.status, 'paused');
  const resumed = playerReducer(paused, { type: 'toggle' });
  assert.deepEqual([resumed.status, resumed.position], ['playing', 1]);
});

test('skipping 30 seconds moves the position and stays inside the recording', () => {
  assert.equal(playing([{ type: 'seekBy', seconds: 30 }]).position, 30);
  assert.equal(playing([{ type: 'seekBy', seconds: -30 }]).position, 0);
  assert.equal(playing([{ type: 'seekBy', seconds: 500 }]).position, 100);
  assert.equal(playing([{ type: 'seekTo', seconds: 42 }]).position, 42);
});

test('running out of recording pauses at the end; play then starts it over', () => {
  const done = playing([{ type: 'seekTo', seconds: 99 }, { type: 'tick' }]);
  assert.deepEqual([done.status, done.position], ['paused', 100]);
  const again = playerReducer(done, { type: 'toggle' });
  assert.deepEqual([again.status, again.position], ['playing', 0]);
});

test('seeking and toggling do nothing without an episode or while loading', () => {
  assert.deepEqual(run([{ type: 'seekBy', seconds: 30 }, { type: 'toggle' }, { type: 'tick' }]), initialPlayerState);
  const loading = run([{ type: 'select', episode }]);
  assert.deepEqual(playerReducer(loading, { type: 'seekBy', seconds: 30 }), loading);
  assert.deepEqual(playerReducer(loading, { type: 'toggle' }), loading);
});

test('stop clears everything', () => {
  assert.deepEqual(playing([{ type: 'tick' }, { type: 'stop' }]), initialPlayerState);
});
