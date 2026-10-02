import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { ScheduleWeekly } from '@/api/types';

import {
  airTimes, formatHm, formatRange, isOnAir, slotsForDay, slotsForShow, stationClock, stationDate,
} from './schedule-state';

test('stationClock: Eastern time whatever the instant', () => {
  // Fri 2 Oct 2026 21:30 UTC = 5:30 PM EDT
  assert.deepEqual(stationClock(new Date('2026-10-02T21:30:00Z')), { day: 'fri', minute: 17 * 60 + 30 });
  // Sat 3 Oct 2026 02:10 UTC = Fri 10:10 PM EDT (still Friday at the station)
  assert.deepEqual(stationClock(new Date('2026-10-03T02:10:00Z')), { day: 'fri', minute: 22 * 60 + 10 });
});

test('stationClock: midnight is minute 0, not 1440', () => {
  assert.equal(stationClock(new Date('2026-10-03T04:00:00Z')).minute, 0); // 12:00 AM EDT Sat
});

test('stationDate: station-local calendar date', () => {
  assert.equal(stationDate(new Date('2026-10-03T02:10:00Z')), '2026-10-02');
  assert.equal(stationDate(new Date('2026-10-03T02:10:00Z'), 28), '2026-10-30');
});

test('isOnAir: inside, edges, wrong day, and shows that run to midnight', () => {
  const slot = { startMin: 17 * 60, endMin: 18 * 60 };
  const fri5pm = (m: number) => new Date(Date.UTC(2026, 9, 2, 21, m)); // 5:mm PM EDT
  assert.equal(isOnAir(slot, 'fri', fri5pm(0)), true);
  assert.equal(isOnAir(slot, 'fri', fri5pm(59)), true);
  assert.equal(isOnAir(slot, 'fri', new Date('2026-10-02T22:00:00Z')), false); // 6:00 PM: ended
  assert.equal(isOnAir(slot, 'thu', fri5pm(30)), false);
  const lateNight = { startMin: 23 * 60, endMin: 0 };
  assert.equal(isOnAir(lateNight, 'fri', new Date('2026-10-03T03:30:00Z')), true); // Fri 11:30 PM
});

test('time formatting', () => {
  assert.equal(formatHm('00:00'), '12:00 AM');
  assert.equal(formatHm('12:30'), '12:30 PM');
  assert.equal(formatHm('13:00'), '1:00 PM');
  assert.equal(formatRange('13:00', '14:00'), '1:00 – 2:00 PM');
  assert.equal(formatRange('11:00', '13:00'), '11:00 AM – 1:00 PM');
});

const slot = (over: Partial<ScheduleWeekly['days'][string][number]>) =>
  ({
    id: 'x', startsAt: '12:00', endsAt: '13:00', startMin: 720, endMin: 780, show: 'S', dj: 'D', genre: '',
    description: '', host: { name: 'D', initials: 'D', bio: '' }, recurring: true, showId: 's', occurrenceId: 'o',
    ...over,
  }) as ScheduleWeekly['days'][string][number];
const weekly = {
  days: {
    mon: [slot({ showId: 'b', startMin: 900, startsAt: '15:00', endsAt: '16:00' }), slot({ showId: 'a' })],
    wed: [slot({ showId: 'a' })],
  },
} as unknown as ScheduleWeekly;

test('slotsForDay sorts by start; missing days are empty', () => {
  assert.deepEqual(slotsForDay(weekly, 'mon').map((s) => s.showId), ['a', 'b']);
  assert.deepEqual(slotsForDay(weekly, 'sun'), []);
  assert.deepEqual(slotsForDay(undefined, 'mon'), []);
});

test('slotsForShow and airTimes', () => {
  const entries = slotsForShow(weekly, 'a');
  assert.deepEqual(entries.map((e) => e.day), ['mon', 'wed']);
  assert.deepEqual(airTimes(entries), ['Mondays 12:00 – 1:00 PM', 'Wednesdays 12:00 – 1:00 PM']);
});
