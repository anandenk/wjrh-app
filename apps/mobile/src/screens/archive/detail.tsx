import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useArchivePlayer } from '@/archive/archive-player-provider';
import { useArchiveCatalog } from '@/archive/use-archive';
import { ShowCover } from '@/components/album-cover';
import { DetailHeader } from '@/components/detail-header';
import { useBottomChrome } from '@/components/dock-metrics';
import { FocusedStatusBar } from '@/components/focused-status-bar';
import { DisplayText, Text } from '@/components/text';
import { DEV_ARCHIVE_PLAY } from '@/config';
import { colors, fonts, gradients } from '@/theme';

import { PastBroadcasts } from './past-broadcasts';
import { Transport } from './transport';

/**
 * One show's archive: the big cover with playback controls over it, the show's name, and its past broadcasts.
 * Demo data only. The controls drive the pretend player in src/archive/, not real audio.
 */
export function ArchiveDetailScreen({ showId }: { showId: string }) {
  const catalog = useArchiveCatalog();
  const player = useArchivePlayer();
  const chrome = useBottomChrome({ screen: 'other' });
  const { width } = useWindowDimensions();

  const show = catalog.shows.find((s) => s.showId === showId);
  // The controls follow the episode being played if it is this show's, otherwise they wait on the newest one.
  const playing = player.episode && player.episode.showId === showId ? player.episode : null;
  const episode = playing ?? show?.episodes[0] ?? null;
  // clamp(38px, 11vw, 52px)
  const nameSize = Math.min(52, Math.max(38, width * 0.11));

  // Dev-only (config.ts): start the newest episode once, so a screenshot can show the playing state.
  const autoPlayed = useRef(false);
  useEffect(() => {
    if (!DEV_ARCHIVE_PLAY || autoPlayed.current || !show || player.episode) return;
    autoPlayed.current = true;
    player.play(show.episodes[0]);
  }, [show, player]);

  return (
    <View style={styles.root}>
      <FocusedStatusBar style="light" />
      <DetailHeader backLabel="ARCHIVE" title="ARCHIVE" fallback="/archive" />
      <ScrollView contentContainerStyle={{ paddingBottom: chrome.contentPadding }} contentInsetAdjustmentBehavior="never">
        {!show || !episode ? (
          <Text style={styles.status}>
            {catalog.isLoading
              ? 'Loading…'
              : catalog.isError
                ? "Can't load this show right now. Go back and try again."
                : "We couldn't find this show."}
          </Text>
        ) : (
          <>
            <View style={[styles.hero, { height: width }]}>
              <ShowCover slot={show.coverSlot} labelled style={StyleSheet.absoluteFill} />
              <LinearGradient {...gradients.showShade} style={StyleSheet.absoluteFill} pointerEvents="none" />
              <Transport
                episode={episode}
                active={playing !== null}
                status={playing ? player.status : 'idle'}
                position={playing ? player.position : 0}
                onToggle={() => (playing ? player.toggle() : player.play(episode))}
                onSeekBy={player.seekBy}
                onSeekTo={player.seekTo}
              />
            </View>

            <View style={styles.copy}>
              <Text style={styles.kicker}>Show archive</Text>
              <DisplayText
                style={[styles.name, { fontSize: nameSize, lineHeight: nameSize * 0.96, letterSpacing: nameSize * 0.01 }]}
                accessibilityRole="header">
                {show.name}
              </DisplayText>
              {show.hosts ? <Text style={styles.host}>with {show.hosts}</Text> : null}
              <Text style={styles.note}>{show.descriptionIsSample ? 'Sample description' : 'About the show'}</Text>
              <Text style={styles.description}>{show.description}</Text>
            </View>

            <PastBroadcasts showId={showId} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.scheduleBg },
  status: { padding: 20, fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.onImageMuted },
  hero: { width: '100%', overflow: 'hidden', backgroundColor: colors.surface2 },
  copy: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.onImageFaint,
  },
  kicker: {
    fontFamily: fonts.bold,
    fontSize: 10,
    lineHeight: 10,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: colors.logoGold,
  },
  name: { marginTop: 8, fontFamily: fonts.display, textTransform: 'uppercase', color: colors.accentInk },
  host: { marginTop: 10, fontFamily: fonts.body, fontSize: 14, lineHeight: 19, color: colors.onImageMuted },
  note: {
    marginTop: 16,
    fontFamily: fonts.bold,
    fontSize: 9,
    lineHeight: 9,
    letterSpacing: 0.72,
    textTransform: 'uppercase',
    color: colors.logoGold,
  },
  description: { marginTop: 8, fontFamily: fonts.body, fontSize: 13, lineHeight: 20, color: colors.onImageMuted },
});
