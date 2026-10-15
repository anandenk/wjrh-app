import assert from 'node:assert/strict';
import { test } from 'node:test';

import scheduleJson from '@/api/fixtures/schedule-weekly.json';
import showsJson from '@/api/fixtures/shows.json';
import type { ScheduleWeekly, Shows } from '@/api/types';

import { buildDemoArchive, coverSlotFor, formatDateLabel, formatDuration, formatPlaybackTime } from './demo-data';

const shows = (showsJson as unknown as Shows).shows;
const weekly = scheduleJson as unknown as ScheduleWeekly;

// Wed 14 Oct 2026. fatou-talks airs Wednesdays 13:00 to 14:00 Eastern in the fixture schedule.
const wedAfterShow = new Date('2026-10-14T19:00:00Z'); // 3:00 PM EDT
const wedBeforeShow = new Date('2026-10-14T16:00:00Z'); // 12:00 PM EDT

const build = (now: Date, list = shows) => buildDemoArchive({ shows: list, weekly, now });
const find = (archive: ReturnType<typeof build>, id: string) => archive.find((s) => s.showId === id)!;

test('every active show gets three episodes, newest first, a week apart, with unique ids', () => {
  const archive = build(wedAfterShow);
  assert.equal(archive.length, shows.filter((s) => s.active).length);
  for (const show of archive) {
    assert.equal(show.episodes.length, 3);
    const dates = show.episodes.map((e) => e.date);
    assert.deepEqual([...dates].sort().reverse(), dates);
    assert.equal((Date.parse(dates[0]) - Date.parse(dates[1])) / 86_400_000, 7);
    assert.equal((Date.parse(dates[1]) - Date.parse(dates[2])) / 86_400_000, 7);
  }
  const ids = archive.flatMap((s) => s.episodes.map((e) => e.id));
  assert.equal(new Set(ids).size, ids.length);
});

test('a scheduled show is archived on its real weekday, and today counts only once its slot is over', () => {
  assert.equal(find(build(wedAfterShow), 'fatou-talks').episodes[0].date, '2026-10-14');
  assert.equal(find(build(wedBeforeShow), 'fatou-talks').episodes[0].date, '2026-10-07');
  // Thursday morning: last Wednesday's recording is the newest.
  assert.equal(find(build(new Date('2026-10-15T14:00:00Z')), 'fatou-talks').episodes[0].date, '2026-10-14');
});

test('the length of a recording is the length of the show’s slot', () => {
  assert.equal(find(build(wedAfterShow), 'fatou-talks').episodes[0].durationSeconds, 3600);
  assert.equal(find(build(wedAfterShow), 'postmodern-jrh').episodes[0].durationSeconds, 7200); // Sun 08:00 to 10:00
});

test('a show missing from this week’s schedule still gets steady sample episodes', () => {
  const noSchedule = buildDemoArchive({ shows, weekly: undefined, now: wedAfterShow });
  const again = buildDemoArchive({ shows, weekly: undefined, now: wedAfterShow });
  assert.deepEqual(noSchedule, again);
  assert.equal(noSchedule[0].episodes[0].durationSeconds, 3600);
});

test('covers follow the active shows’ order; inactive shows are skipped', () => {
  const list = shows.map((s, i) => (i === 1 ? { ...s, active: false } : s));
  const archive = build(wedAfterShow, list);
  assert.deepEqual(
    archive.slice(0, 3).map((s) => s.coverSlot),
    [0, 1, 2],
  );
  assert.equal(archive[1].showId, list[2].id);
  assert.equal(coverSlotFor(list, list[1].id), null);
  assert.equal(coverSlotFor(list, list[2].id), 1);
  assert.equal(coverSlotFor(undefined, 'x'), null);
  assert.equal(coverSlotFor(list, null), null);
});

test('episodes carry the show’s name and hosts for the player to print', () => {
  const show = find(build(wedAfterShow), 'fatou-talks');
  assert.equal(show.episodes[0].showName, show.name);
  assert.equal(show.episodes[0].hosts, show.hosts);
  assert.ok(show.hosts.length > 0);
});

test('every archived show has a genre line and a description, flagged as sample when the API has none', () => {
  for (const show of build(wedAfterShow)) {
    assert.ok(show.genres.length > 0, `${show.showId} has no genre line`);
    assert.ok(show.description.length > 0, `${show.showId} has no description`);
    assert.equal(show.descriptionIsSample, true, `${show.showId}: the fixture has no real description`);
  }
});

test('what the API really says wins over the sample', () => {
  const list = shows.map((s, i) =>
    i === 0 ? { ...s, description: 'Written by the station.', genres: ['Jazz', 'Blues'] } : s,
  );
  const [first, second] = build(wedAfterShow, list);
  assert.equal(first.description, 'Written by the station.');
  assert.equal(first.descriptionIsSample, false);
  assert.equal(first.genres, 'Jazz · Blues');
  assert.equal(second.descriptionIsSample, true);
});

test('a genre from this week’s calendar wins over the sample genre', () => {
  // The Rodeo has "Folk and anti-folk" in the fixture schedule.
  assert.equal(find(build(wedAfterShow), 'the-rodeo').genres, 'Folk and anti-folk');
});

test('formatDateLabel, formatPlaybackTime, formatDuration', () => {
  assert.equal(formatDateLabel('2026-09-07'), 'Sep 7, 2026');
  assert.equal(formatPlaybackTime(0), '0:00');
  assert.equal(formatPlaybackTime(125), '2:05');
  assert.equal(formatPlaybackTime(3723), '1:02:03');
  assert.equal(formatPlaybackTime(Number.NaN), '0:00');
  assert.equal(formatDuration(3600), '1 hr');
  assert.equal(formatDuration(5400), '1 hr 30 min');
  assert.equal(formatDuration(2700), '45 min');
});
