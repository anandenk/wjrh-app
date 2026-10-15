import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';

import { DEMO_ARCHIVES } from '@/config';

import { coverSeed } from './demo-art';
import { cleanTitle, pickArtwork, searchUrl, type ItunesSong } from './track-art';

// DEMO ONLY. Looks a track's real cover up with Apple's public iTunes Search API (see track-art.ts). Found covers are
// kept on the phone (their own small entries, apart from the app's saved API answers), so a track already seen is
// not looked up again and the demo still has its covers with no signal. Nothing found is not saved, so the next launch
// tries again.

const KEY_PREFIX = 'wjrh-demo-art:v1:';
const GAP_MS = 350; // Apple allows about 20 searches a minute; a list of recent tracks asks for many at once

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// One search at a time, a little apart.
let queue: Promise<unknown> = Promise.resolve();
function oneAtATime<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.then(
    () => sleep(GAP_MS),
    () => sleep(GAP_MS),
  );
  return run;
}

async function findArtwork(title: string, artist: string, signal: AbortSignal): Promise<string | null> {
  const key = KEY_PREFIX + coverSeed(title, artist);
  try {
    const saved = await AsyncStorage.getItem(key);
    if (saved) return saved;
  } catch {
    // storage unavailable: just look it up
  }
  const cleaned = cleanTitle(title, artist);
  const res = await oneAtATime(() => fetch(searchUrl(cleaned, artist), { signal }));
  if (!res.ok) throw new Error(`iTunes search answered ${res.status}`);
  const body = (await res.json()) as { results?: ItunesSong[] };
  const url = pickArtwork(body.results ?? [], cleaned, artist);
  if (url) AsyncStorage.setItem(key, url).catch(() => {});
  return url;
}

/**
 * The real cover of a track as Apple's 100 px link (resize it with `sizedArtwork`), or null while it is being found,
 * when nothing fits, and always outside demo mode.
 */
export function useTrackArtwork(title: string | null | undefined, artist: string | null | undefined): string | null {
  const enabled = DEMO_ARCHIVES && !!title && !!artist;
  const q = useQuery({
    queryKey: ['demo-track-art', coverSeed(title, artist)],
    queryFn: ({ signal }) => findArtwork(title!, artist!, signal),
    enabled,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
    retryDelay: 5000,
  });
  return q.data ?? null;
}
