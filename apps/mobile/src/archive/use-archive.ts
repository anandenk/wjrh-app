import type { ImageSource } from 'expo-image';
import { useMemo } from 'react';

import { useShows, useWeeklySchedule } from '@/api/queries';
import { DEMO_ARCHIVES } from '@/config';
import { DEMO_COVERS } from '@/content/demo-covers';

import { AUTOMATION_ALBUM, albumArtUrl, albumForSlot } from './demo-albums';
import { buildDemoArchive, coverSlotFor, type DemoArchiveShow } from './demo-data';

/** The bundled placeholder cover for a slot (five, repeating): what shows while a real album cover loads, or when it can't. */
export function coverImage(slot: number): ImageSource {
  return DEMO_COVERS[slot % DEMO_COVERS.length];
}

/**
 * DEMO ONLY: the sample archive for every real show. It needs the show list; the schedule is optional and only
 * decides which weekday and length the sample recordings get.
 */
export function useArchiveCatalog(): { shows: DemoArchiveShow[]; isLoading: boolean; isError: boolean } {
  const shows = useShows();
  const weekly = useWeeklySchedule();
  const list = shows.data?.shows;
  const archive = useMemo(
    () => (list ? buildDemoArchive({ shows: list, weekly: weekly.data, now: new Date() }) : []),
    [list, weekly.data],
  );
  return { shows: archive, isLoading: shows.isPending, isError: shows.isError && !list };
}

/** DEMO ONLY: a show's real-album placeholder cover, or null when demo mode is off or the show has no tile. */
export function useDemoCover(showId: string | null | undefined): ImageSource | null {
  const shows = useShows();
  if (!DEMO_ARCHIVES) return null;
  const slot = coverSlotFor(shows.data?.shows, showId);
  return slot === null ? null : { uri: albumArtUrl(albumForSlot(slot), 1000) };
}

/** DEMO ONLY: the picture for the Now screen while the station is on automation, or null when demo mode is off. */
export function useAutomationCover(): ImageSource | null {
  return DEMO_ARCHIVES ? { uri: albumArtUrl(AUTOMATION_ALBUM, 1000) } : null;
}
