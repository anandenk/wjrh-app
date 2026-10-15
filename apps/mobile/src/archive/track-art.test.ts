import assert from 'node:assert/strict';
import { test } from 'node:test';

import { cleanTitle, pickArtwork, searchUrl, sizedArtwork, type ItunesSong } from './track-art';

const art = (n: string) => `https://is1-ssl.mzstatic.com/image/thumb/${n}/100x100bb.jpg`;
const song = (artistName: string, trackName: string, collectionName: string): ItunesSong => ({
  artistName,
  trackName,
  collectionName,
  artworkUrl100: art(`${artistName}-${collectionName}`),
});

test('cleanTitle drops edit and version notes, features, and a stuck-on artist', () => {
  assert.equal(cleanTitle('Bittersweet Symphony (Radio Edit)'), 'Bittersweet Symphony');
  assert.equal(cleanTitle('All My Friends Are So Depressed (Clean Version)'), 'All My Friends Are So Depressed');
  assert.equal(cleanTitle('Cancel Me (I’m Tired) (Radio Edit)'), 'Cancel Me (I’m Tired)', 'keeps a bracket that is part of the name');
  assert.equal(cleanTitle('Get LuckyDaft Punk (ft. Pharrell Williams)', 'Daft Punk'), 'Get Lucky');
  assert.equal(cleanTitle('Heroes - 2017 Remastered Version'.replace('2017 ', ''), 'David Bowie'), 'Heroes');
  assert.equal(cleanTitle('Lost Boys', 'Phoebe Bridgers'), 'Lost Boys');
  assert.equal(cleanTitle('Daft Punk', 'Daft Punk'), 'Daft Punk', 'never strips a title down to nothing');
});

test('searchUrl asks for songs', () => {
  const url = new URL(searchUrl('Hella Good', 'No Doubt'));
  assert.equal(url.origin + url.pathname, 'https://itunes.apple.com/search');
  assert.equal(url.searchParams.get('term'), 'Hella Good No Doubt');
  assert.equal(url.searchParams.get('entity'), 'song');
});

// Results as Apple returned them for tracks in the station's feed.
test('picks the original album over a single, an EP or a compilation', () => {
  const hella = [
    song('No Doubt', 'Hella Good', 'The Singles 1992-2003'),
    song('No Doubt', 'Hella Good', 'Hella Good - Single'),
    song('No Doubt', 'Hella Good', 'Rock Steady (Bonus Track Version)'),
  ];
  assert.equal(pickArtwork(hella, 'Hella Good', 'No Doubt'), hella[2].artworkUrl100);
  const monkey = [
    song('Pixies', 'Monkey Gone to Heaven', 'Doolittle'),
    song('Pixies', 'Monkey Gone to Heaven', 'Monkey Gone to Heaven - EP'),
    song('Pixies', 'Monkey Gone to Heaven (Mark Goodier Session)', 'Pixies at the BBC, 1988-91'),
  ];
  assert.equal(pickArtwork(monkey, 'Monkey Gone To Heaven', 'Pixies'), monkey[0].artworkUrl100);
});

test('"Verve" is "The Verve", and the wrong artist never matches', () => {
  const results = [song('Royal Philharmonic Orchestra', 'Bittersweet Symphony', 'Symphonic Rock'), song('The Verve', 'Bittersweet Symphony', 'Urban Hymns')];
  assert.equal(pickArtwork(results, 'Bittersweet Symphony', 'Verve'), results[1].artworkUrl100);
  assert.equal(pickArtwork(results.slice(0, 1), 'Bittersweet Symphony', 'Verve'), null);
});

test('a single whose name matches counts, even when the song on it is a B-side', () => {
  const fatDog = [song('Fat Dog', 'Snakes', 'Cancel Me (I\'m Tired)'), song('Fugees', 'Nappy Heads (Remix Radio Edit)', 'Greatest Hits')];
  assert.equal(pickArtwork(fatDog, 'Cancel Me (I’m Tired)', 'Fat Dog'), fatDog[0].artworkUrl100);
});

test('nothing fits: null (the generated cover stays)', () => {
  assert.equal(pickArtwork([], 'Cellophane Wing', 'Miri Vale'), null);
  assert.equal(pickArtwork([song('Jalan Fields', 'TWISTED TRUTH (feat. COBRA.)', 'To My Past Lovers')], 'Cobra', 'Geese'), null);
  assert.equal(pickArtwork([{ artistName: 'Geese', trackName: 'Cobra', collectionName: 'Getting Killed' }], 'Cobra', 'Geese'), null, 'no artwork link');
});

test('sizedArtwork swaps the size at the end of the link', () => {
  assert.equal(sizedArtwork(art('x'), 600), 'https://is1-ssl.mzstatic.com/image/thumb/x/600x600bb.jpg');
  assert.equal(sizedArtwork('https://example.com/other.jpg', 600), 'https://example.com/other.jpg');
});
