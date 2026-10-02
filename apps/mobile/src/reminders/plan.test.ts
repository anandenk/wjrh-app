import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Schedule } from '@/api/types';

import { planReminders } from './plan';

const NOW = new Date('2026-10-02T12:00:00-04:00');
const occ = (id: string, showId: string, startsAt: string, over: object = {}) =>
  ({
    id, showId, title: `Show ${showId}`, hostNames: ['Ann'], startsAt, endsAt: startsAt,
    cancelled: false, recurring: true, hasProfile: true, ...over,
  }) as Schedule['occurrences'][number];

test('plans only chosen shows, only future, skips cancelled, in time order', () => {
  const plan = planReminders({
    now: NOW,
    showIds: new Set(['a']),
    occurrences: [
      occ('3', 'a', '2026-10-09T16:00:00-04:00'),
      occ('1', 'a', '2026-10-02T16:00:00-04:00'),
      occ('2', 'a', '2026-10-05T16:00:00-04:00', { cancelled: true }),
      occ('p', 'a', '2026-10-02T09:00:00-04:00'), // already started
      occ('x', 'b', '2026-10-03T16:00:00-04:00'), // not chosen
    ],
  });
  assert.deepEqual(plan.map((p) => p.id), ['reminder:1', 'reminder:3']);
  assert.equal(plan[0].title, 'Show a is starting');
  assert.equal(plan[0].body, 'with Ann · WJRH 104.9 FM');
  assert.equal(plan[0].showId, 'a');
});

test('respects the horizon and the cap (soonest kept)', () => {
  const many = Array.from({ length: 10 }, (_, i) =>
    occ(String(i), 'a', new Date(NOW.getTime() + (i + 1) * 86_400_000).toISOString()),
  );
  assert.deepEqual(
    planReminders({ now: NOW, showIds: new Set(['a']), occurrences: many, maxCount: 3 }).map((p) => p.id),
    ['reminder:0', 'reminder:1', 'reminder:2'],
  );
  assert.equal(planReminders({ now: NOW, showIds: new Set(['a']), occurrences: many, horizonDays: 2 }).length, 2);
});

test('a show with no hosts still gets a body', () => {
  const [p] = planReminders({
    now: NOW, showIds: new Set(['a']), occurrences: [occ('1', 'a', '2026-10-02T16:00:00-04:00', { hostNames: [] })],
  });
  assert.equal(p.body, 'WJRH 104.9 FM');
});

test('nothing chosen -> nothing planned', () => {
  assert.deepEqual(planReminders({ now: NOW, showIds: new Set(), occurrences: [occ('1', 'a', '2026-10-03T16:00:00-04:00')] }), []);
});
