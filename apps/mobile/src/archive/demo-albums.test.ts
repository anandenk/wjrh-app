import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AUTOMATION_ALBUM, DEMO_ALBUMS, albumArtUrl, albumForSlot } from './demo-albums';

test('there are enough different albums that every show gets its own', () => {
  assert.ok(DEMO_ALBUMS.length >= 30, `${DEMO_ALBUMS.length} albums`);
  assert.equal(new Set(DEMO_ALBUMS.map((a) => a.url)).size, DEMO_ALBUMS.length, 'a cover appears twice');
  assert.equal(new Set(DEMO_ALBUMS.map((a) => `${a.artist}|${a.album}`)).size, DEMO_ALBUMS.length, 'an album appears twice');
});

test('the automation picture is not one of the show covers', () => {
  assert.ok(!DEMO_ALBUMS.some((a) => a.url === AUTOMATION_ALBUM.url));
});

test('every link is Apple’s image service with a size slot', () => {
  for (const a of [...DEMO_ALBUMS, AUTOMATION_ALBUM]) {
    assert.match(a.url, /^https:\/\/is\d-ssl\.mzstatic\.com\/image\/thumb\/.+\/\{size\}x\{size\}bb\.jpg$/, `${a.artist}: ${a.url}`);
    assert.ok(a.artist.length > 0 && a.album.length > 0);
  }
});

test('albumForSlot gives each of the first slots a different album, and wraps', () => {
  const first = Array.from({ length: DEMO_ALBUMS.length }, (_, i) => albumForSlot(i).url);
  assert.equal(new Set(first).size, DEMO_ALBUMS.length);
  assert.equal(albumForSlot(DEMO_ALBUMS.length).url, albumForSlot(0).url);
  assert.equal(albumForSlot(-1).url, albumForSlot(DEMO_ALBUMS.length - 1).url);
});

test('albumArtUrl fills the size', () => {
  assert.match(albumArtUrl(DEMO_ALBUMS[0], 800), /\/800x800bb\.jpg$/);
});
