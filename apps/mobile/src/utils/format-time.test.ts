import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatStationTime } from './format-time';

test('formats in station (Eastern) time whatever the offset in the input', () => {
  assert.equal(formatStationTime('2026-10-02T17:18:00-04:00'), '5:18 PM');
  assert.equal(formatStationTime('2026-10-02T21:18:00Z'), '5:18 PM'); // UTC input, same instant
});

test('unparseable input gives an empty string, not "Invalid Date"', () => {
  assert.equal(formatStationTime('nope'), '');
});
