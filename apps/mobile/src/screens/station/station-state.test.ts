import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatEventDate, splitEvents, teamView } from './station-state';

const team = [{ name: 'A', role: 'GM', email: 'a@lafayette.edu' }];

test('teamView: hidden until the station approves the roster', () => {
  assert.deepEqual(teamView({ approved: false, team }), { kind: 'hidden' });
  assert.deepEqual(teamView(undefined), { kind: 'hidden' });
  assert.deepEqual(teamView({ approved: true, team }), { kind: 'list', members: team });
});

test('splitEvents: upcoming ascending, past descending, today counts as upcoming', () => {
  const events = [
    { name: 'old', date: '2025-10-15' },
    { name: 'older', date: '2025-09-01' },
    { name: 'later', date: '2026-11-01' },
    { name: 'today', date: '2026-10-02' },
    { name: 'soon', date: '2026-10-05' },
  ];
  const { upcoming, past } = splitEvents(events, '2026-10-02');
  assert.deepEqual(upcoming.map((e) => e.name), ['today', 'soon', 'later']);
  assert.deepEqual(past.map((e) => e.name), ['old', 'older']);
});

test('formatEventDate', () => {
  assert.equal(formatEventDate('2025-10-16'), 'October 16, 2025');
  assert.equal(formatEventDate('2026-01-05'), 'January 5, 2026');
  assert.equal(formatEventDate('soon'), 'soon');
  assert.equal(formatEventDate('2026-13-01'), '2026-13-01');
});
