import assert from 'node:assert/strict';
import { test } from 'node:test';

import { COVER_H, COVER_W, PALETTES, STYLES, coverSeed, generateCover, type CoverShape } from './demo-art';

// Tracks of the sort the station plays, as the API would list them.
const TRACKS: [string, string][] = [
  ['Get Lucky', 'Daft Punk'], ['Cancel Me (I’m Tired) (Radio Edit)', 'Fat Dog'], ['It’s Time', 'Imagine Dragons'],
  ['Lost Boys', 'Phoebe Bridgers'], ['All My Friends Are So Depressed', 'Joyce Manor'], ['Cellophane Wing', 'Miri Vale'],
  ['Motion Sickness', 'Phoebe Bridgers'], ['Heartbeats', 'The Knife'], ['Kids', 'MGMT'], ['Silver Soul', 'Beach House'],
  ['Pink + White', 'Frank Ocean'], ['Dreams', 'Fleetwood Mac'], ['Float On', 'Modest Mouse'], ['Reptilia', 'The Strokes'],
  ['Teardrop', 'Massive Attack'], ['Genesis', 'Grimes'], ['Paranoid Android', 'Radiohead'], ['Maps', 'Yeah Yeah Yeahs'],
  ['Redbone', 'Childish Gambino'], ['Electric Feel', 'MGMT'], ['Do I Wanna Know?', 'Arctic Monkeys'], ['Nikes', 'Frank Ocean'],
  ['Ceilings', 'Rex Orange County'], ['Space Song', 'Beach House'], ['Everything In Its Right Place', 'Radiohead'],
  ['Sunday Morning', 'The Velvet Underground'], ['Hounds of Love', 'Kate Bush'], ['Pynk', 'Janelle Monáe'],
  ['Cherry-coloured Funk', 'Cocteau Twins'], ['Gimme Shelter', 'The Rolling Stones'], ['Dog Days Are Over', 'Florence + The Machine'],
  ['Mirrorball', 'Taylor Swift'], ['Fake Plastic Trees', 'Radiohead'], ['Time to Pretend', 'MGMT'], ['Under Pressure', 'Queen'],
  ['Blue Monday', 'New Order'], ['Pyramids', 'Frank Ocean'], ['Ivy', 'Frank Ocean'], ['Cranes in the Sky', 'Solange'], ['Hyperreal', 'Flume'],
];
const covers = TRACKS.map(([title, artist]) => generateCover(coverSeed(title, artist)));

test('the same track always gets the same cover', () => {
  assert.deepEqual(generateCover(coverSeed('Get Lucky', 'Daft Punk')), generateCover(coverSeed('Get Lucky', 'Daft Punk')));
});

test('case and spacing do not change a track’s cover; a different track does', () => {
  assert.equal(coverSeed('  Get LUCKY ', 'daft punk'), coverSeed('Get Lucky', 'Daft Punk'));
  assert.notDeepEqual(generateCover(coverSeed('Get Lucky', 'Daft Punk')), generateCover(coverSeed('Kids', 'MGMT')));
  assert.equal(coverSeed(null, undefined), '|');
});

test('a spread of tracks uses most of the styles and most of the palettes', () => {
  const styles = new Set(covers.map((c) => c.style));
  const palettes = new Set(covers.map((c) => c.palette));
  assert.ok(styles.size >= 8, `only ${styles.size} of ${STYLES.length} styles in ${TRACKS.length} tracks`);
  assert.ok(palettes.size >= 9, `only ${palettes.size} of ${PALETTES.length} palettes in ${TRACKS.length} tracks`);
});

test('no two of the sample tracks end up with identical pictures', () => {
  assert.equal(new Set(covers.map((c) => JSON.stringify(c))).size, covers.length);
});

const numbers = (s: CoverShape): number[] => {
  switch (s.k) {
    case 'rect':
      return [s.x, s.y, s.w, s.h];
    case 'circle':
      return [s.cx, s.cy, s.r, s.sw ?? 0];
    case 'path':
      return [s.sw ?? 0, ...(s.d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number)];
  }
};

test('every cover is a small, well-formed set of shapes in the palette’s colours', () => {
  for (const c of covers) {
    const p = PALETTES[c.palette];
    const allowed = new Set([p.bg, p.a, p.b, p.c]);
    assert.ok(c.shapes.length >= 2 && c.shapes.length <= 30, `${c.style}: ${c.shapes.length} shapes`);
    assert.equal(c.background, p.bg);
    for (const s of c.shapes) {
      for (const n of numbers(s)) assert.ok(Number.isFinite(n), `${c.style}: a shape has a non-number`);
      for (const colour of [('fill' in s && s.fill) || null, ('stroke' in s && s.stroke) || null]) {
        if (colour) assert.ok(allowed.has(colour), `${c.style}: ${colour} is not in palette ${c.palette}`);
      }
      assert.ok('fill' in s && s.fill ? true : 'stroke' in s && s.stroke, `${c.style}: a shape has no colour`);
    }
  }
});

test('every style can be drawn, and keeps its drawing near the canvas', () => {
  // Find a seed for each style (there are only ten), then check the shapes are not wildly off the canvas.
  const byStyle = new Map<string, ReturnType<typeof generateCover>>();
  for (let i = 0; byStyle.size < STYLES.length && i < 5000; i++) {
    const c = generateCover(`probe ${i}`);
    if (!byStyle.has(c.style)) byStyle.set(c.style, c);
  }
  assert.equal(byStyle.size, STYLES.length);
  for (const [style, c] of byStyle) {
    const circles = c.shapes.filter((s): s is Extract<CoverShape, { k: 'circle' }> => s.k === 'circle');
    for (const s of circles) assert.ok(s.cx > -COVER_W && s.cx < COVER_W * 2 && s.cy > -COVER_H * 2 && s.cy < COVER_H * 3, `${style}: circle far off`);
  }
});
