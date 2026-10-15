import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Health, NowPlaying } from '@/api/types';

import { showHeading, statusNotice, trackLines, usableNowPlaying } from './now-state';

const show = {
  id: 'amber-on-audio',
  occurrenceId: 'x',
  name: 'Amber on Audio',
  hostNames: ['Amber'],
  startsAt: '2026-10-02T17:00:00-04:00',
  endsAt: '2026-10-02T18:00:00-04:00',
  hasProfile: true,
};
const np = (over: Partial<NowPlaying>): NowPlaying => ({
  asOf: '2026-10-02T17:20:00-04:00',
  sourceUpdatedAt: null,
  stale: false,
  live: false,
  automation: false,
  track: null,
  show: null,
  nextShow: null,
  ...over,
});

test('heading: live show with hosts', () => {
  assert.deepEqual(showHeading(np({ live: true, show })), {
    badge: 'LIVE',
    title: 'Amber on Audio',
    subtitle: 'with Amber',
  });
});

test('heading: automation with no show', () => {
  assert.deepEqual(showHeading(np({ automation: true })), {
    badge: 'AUTOMATED',
    title: 'WJRH 104.9 FM',
    subtitle: 'Automated programming',
  });
});

test('heading: no data at all still names the station', () => {
  assert.equal(showHeading(undefined).title, 'WJRH 104.9 FM');
  assert.equal(showHeading(undefined).badge, null);
});

test('track: null fields get explicit empty states, never "TBD"', () => {
  const t = trackLines({ title: 'Song', artist: null, album: null, artworkUrl: null });
  assert.equal(t.artist, 'Artist metadata unavailable');
  assert.equal(t.album, null); // album is simply omitted until known
  assert.ok(!JSON.stringify(t).includes('TBD'));
  assert.equal(trackLines({ title: null, artist: null, album: null, artworkUrl: null }).known, false);
});

test('track: no track', () => {
  assert.equal(trackLines(null).title, 'Waiting for track information');
});

const health = (stream: Health['services']['stream']['status']) =>
  ({ services: { stream: { status: stream } } }) as Health;
const base = {
  health: undefined,
  offline: false,
  nowPlayingFailedWithNoData: false,
  showingStaleSince: null,
  lastKnownAt: null,
  metadataStale: false,
};

test('notice: nothing wrong -> none', () => {
  assert.equal(statusNotice(base), null);
  assert.equal(statusNotice({ ...base, health: health('ok') }), null);
});

test('notice: stream down wins over everything', () => {
  assert.match(statusNotice({ ...base, health: health('down'), nowPlayingFailedWithNoData: true })!, /stream/i);
});

test('notice: API unreachable says live audio still works', () => {
  assert.match(statusNotice({ ...base, nowPlayingFailedWithNoData: true })!, /Live audio still works/);
});

test('notice: stale data is labelled with its time', () => {
  assert.match(statusNotice({ ...base, showingStaleSince: '5:18 PM' })!, /5:18 PM/);
});

test('notice: offline with an old answer labels it with its time', () => {
  const n = statusNotice({ ...base, offline: true, lastKnownAt: '5:18 PM', health: health('down') })!;
  assert.match(n, /offline/i); // offline wins over the stream notice: the phone can't know either way
  assert.match(n, /5:18 PM/);
});

test('notice: offline with nothing saved does not claim live audio still works', () => {
  const n = statusNotice({ ...base, offline: true })!;
  assert.match(n, /offline/i);
  assert.ok(!/still works/i.test(n));
});

const answer = np({ live: true, show });
const early = { data: answer, fromEarlierRun: true, fetching: true, offline: false };

test('usable now-playing: an earlier run\'s answer is hidden while a fresh one loads', () => {
  assert.equal(usableNowPlaying(early), undefined);
});

test('usable now-playing: kept when offline, after a failed refresh, or once it is fresh', () => {
  assert.equal(usableNowPlaying({ ...early, offline: true }), answer); // nothing fresh is coming
  assert.equal(usableNowPlaying({ ...early, fetching: false }), answer); // refresh failed: shown with a notice
  assert.equal(usableNowPlaying({ ...early, fromEarlierRun: false }), answer); // this run's own answer
  assert.equal(usableNowPlaying({ ...early, data: undefined }), undefined);
});
