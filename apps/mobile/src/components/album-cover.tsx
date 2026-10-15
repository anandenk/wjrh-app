import { Image, type ImageStyle } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, type StyleProp } from 'react-native';

import { GeneratedCover } from '@/components/generated-cover';
import { coverSeed } from '@/archive/demo-art';
import { AUTOMATION_ALBUM, DEMO_ALBUMS, albumArtUrl, albumForSlot } from '@/archive/demo-albums';
import { sizedArtwork } from '@/archive/track-art';
import { useTrackArtwork } from '@/archive/use-track-art';
import { coverImage } from '@/archive/use-archive';

/** The size every show cover is loaded at (one size, so each picture is saved on the phone once). */
export const SHOW_COVER_SIZE = 1000;

/**
 * DEMO ONLY: a show's placeholder cover, a real album (src/archive/demo-albums.ts). It is loaded from Apple's image
 * service the first time and kept on the phone; while it loads, or if it cannot be had, one of the bundled covers
 * shows instead.
 */
export function ShowCover({
  slot,
  style,
  labelled = false,
}: {
  slot: number;
  style?: StyleProp<ImageStyle>;
  /** Give the picture a label for screen readers; leave it off when something around it already says what it is. */
  labelled?: boolean;
}) {
  const album = albumForSlot(slot);
  const fallback = coverImage(slot);
  const [failed, setFailed] = useState(false);
  return (
    <Image
      source={failed ? fallback : { uri: albumArtUrl(album, SHOW_COVER_SIZE) }}
      placeholder={fallback}
      placeholderContentFit="cover"
      transition={250}
      onError={() => setFailed(true)}
      contentFit="cover"
      accessible={labelled}
      accessibilityLabel={labelled ? `Placeholder cover: ${album.album} by ${album.artist}` : undefined}
      style={style}
    />
  );
}

/**
 * DEMO ONLY: the cover behind a "Recently played" row. The generated picture (src/archive/demo-art.ts) is always there
 * first; the track's real cover, found with the iTunes Search API, fades in over it when there is one.
 */
export function TrackCover({ title, artist }: { title: string | null; artist: string | null }) {
  const real = useTrackArtwork(title, artist);
  return (
    <>
      <GeneratedCover seed={coverSeed(title, artist)} />
      {real ? (
        <Image
          source={{ uri: sizedArtwork(real, 600) }}
          transition={300}
          contentFit="cover"
          accessible={false}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
    </>
  );
}

/** DEMO ONLY: fetch every show cover now, so the demo still has them with no signal (they are kept on the phone). */
export function prefetchDemoCovers(): void {
  const urls = [AUTOMATION_ALBUM, ...DEMO_ALBUMS].map((a) => albumArtUrl(a, SHOW_COVER_SIZE));
  void Image.prefetch(urls, 'disk').catch(() => {});
}
