import assert from 'node:assert/strict';
import { test } from 'node:test';

import scheduleJson from '@/api/fixtures/schedule-weekly.json';
import showsJson from '@/api/fixtures/shows.json';
import type { ScheduleWeekly, Shows } from '@/api/types';

import { DEMO_SHOW_INFO_IDS, demoShowInfo } from './demo-show-info';

const shows = (showsJson as unknown as Shows).shows;
const weekly = scheduleJson as unknown as ScheduleWeekly;

test('every real show has a hand-written sample, and nothing in the list is for a show that does not exist', () => {
  const ids = shows.map((s) => s.id);
  assert.deepEqual(ids.filter((id) => !DEMO_SHOW_INFO_IDS.includes(id)), [], 'a show has no sample');
  assert.deepEqual(DEMO_SHOW_INFO_IDS.filter((id) => !ids.includes(id)), [], 'a sample is for no show');
});

test('descriptions are short, finished sentences, and no two shows share one', () => {
  const descriptions = DEMO_SHOW_INFO_IDS.map((id) => demoShowInfo(id, id).description);
  for (const d of descriptions) {
    assert.ok(d.length >= 30 && d.length <= 160, `length ${d.length}: ${d}`);
    assert.match(d, /[.!?]$/, `not a finished sentence: ${d}`);
  }
  assert.equal(new Set(descriptions).size, descriptions.length);
});

test('every show has a genre line, and the shows the calendar gives a genre for agree with it', () => {
  for (const id of DEMO_SHOW_INFO_IDS) assert.ok(demoShowInfo(id, id).genres.trim().length > 0, id);
  const real = Object.values(weekly.days)
    .flat()
    .filter((slot) => slot.genre);
  assert.ok(real.length >= 5, 'the fixture schedule should have some real genres to compare with');
  // The calendar sometimes cuts a long genre short with "…" (The Bit): the sample then continues the same words.
  for (const slot of real) {
    assert.ok(demoShowInfo(slot.showId, slot.show).genres.startsWith(slot.genre.replace(/…$/, '')), slot.showId);
  }
});

test('a show that is not in the list still gets something, built from its name', () => {
  const info = demoShowInfo('brand-new-show', 'Brand New Show');
  assert.equal(info.genres, 'Eclectic');
  assert.ok(info.description.includes('Brand New Show'));
});
