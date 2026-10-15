// DEMO ONLY (EXPO_PUBLIC_DEMO_ARCHIVES=1). Finds the real cover of a track in Recently played, with Apple's public
// iTunes Search API, so the demo shows real album art. These are the pure parts (cleaning the title, building the
// search, picking the right result), so they can be tested; the fetching and caching are in use-track-art.ts.
//
// The covers are other people's artwork: fine for a private pitch, not licensed for a release (see demo-albums.ts).

export type ItunesSong = {
  artistName?: string;
  trackName?: string;
  collectionName?: string;
  artworkUrl100?: string;
};

// Words that make a bracket or a " - suffix" noise for a search: "(Radio Edit)", "(Clean Version)", "(ft. X)".
const NOISE = 'radio edit|edit|clean|explicit|version|remaster(?:ed)?|mono|stereo|mix|live|feat\\.?|ft\\.?|featuring';

/**
 * The song's name as a catalogue would have it: without "(Radio Edit)", "(Clean Version)", "(ft. X)" or a
 * " - Remastered" tail, and without the artist when the station's feed has stuck it onto the end of the title
 * ("Get LuckyDaft Punk (ft. Pharrell Williams)" for Get Lucky by Daft Punk).
 */
export function cleanTitle(title: string, artist?: string | null): string {
  let t = title.replace(new RegExp(`\\s*[(\\[][^)\\]]*\\b(?:${NOISE})\\b[^)\\]]*[)\\]]`, 'gi'), '');
  t = t.replace(new RegExp(`\\s+-\\s+(?:${NOISE})\\b.*$`, 'i'), '');
  const a = artist?.trim();
  if (a && t.length > a.length && t.toLowerCase().endsWith(a.toLowerCase())) t = t.slice(0, t.length - a.length);
  return t.trim();
}

/** Lowercase letters and digits only, accents folded, a leading "the" dropped: for comparing names. */
function plain(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/^the /, '');
}

function sameArtist(found: string | undefined, wanted: string): boolean {
  const a = plain(found ?? '');
  const b = plain(wanted);
  return a.length > 0 && b.length > 0 && (a === b || a.includes(b) || b.includes(a));
}

function sameTitle(found: string | undefined, wanted: string): boolean {
  const a = plain(found ?? '');
  const b = plain(wanted);
  return b.length >= 3 && a.length > 0 && (a === b || a.includes(b) || b.includes(a));
}

export function searchUrl(title: string, artist: string, limit = 8): string {
  const params = new URLSearchParams({ term: `${title} ${artist}`, media: 'music', entity: 'song', limit: String(limit) });
  return `https://itunes.apple.com/search?${params.toString()}`;
}

// Prefer the original album over a single, an EP, a live take or a compilation of the same song.
function score(r: ItunesSong): number {
  const album = r.collectionName ?? '';
  let s = 0;
  if (/\s-\s(?:single|ep)$/i.test(album)) s += 5;
  if (/\b(?:live|sessions?|greatest|hits|singles|best of|collection|karaoke|tribute|remix|anthology)\b/i.test(album)) s += 4;
  if (/\b(?:live|remix|acoustic|session|instrumental)\b/i.test(r.trackName ?? '')) s += 3;
  return s;
}

/**
 * The cover for a track out of the search results: from the right artist, and a song or an album with the right name,
 * the original album first. Null when nothing fits (an unknown artist, a student band the catalogue lacks): the
 * caller keeps the generated cover.
 */
export function pickArtwork(results: ItunesSong[], title: string, artist: string): string | null {
  const fits = results.filter(
    (r) =>
      r.artworkUrl100 &&
      sameArtist(r.artistName, artist) &&
      (sameTitle(r.trackName, title) || sameTitle(r.collectionName, title)),
  );
  fits.sort((x, y) => score(x) - score(y)); // stable: the search's own order breaks ties
  return fits[0]?.artworkUrl100 ?? null;
}

/** Apple's artwork links end in the size: this asks for another, e.g. 600 gives ".../600x600bb.jpg". */
export function sizedArtwork(url: string, size: number): string {
  return url.replace(/\/\d+x\d+(bb)?\.(jpg|png)$/i, `/${size}x${size}bb.$2`);
}
