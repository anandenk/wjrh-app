import { useRouter } from 'expo-router';
import { useRef } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { isFromEarlierRun } from '@/api/cache-rules';
import { isShowingStale, useHealth, useNowPlaying, useRecent, useShows } from '@/api/queries';
import { useLivePlayerContext } from '@/audio/live-player-provider';
import { useBottomChrome } from '@/components/dock-metrics';
import { FocusedStatusBar } from '@/components/focused-status-bar';
import { Text } from '@/components/text';
import { IMAGES } from '@/content/images';
import { useDevScroll } from '@/dev/dev-scroll';
import { useIsOnline } from '@/hooks/use-online';
import { colors, fonts } from '@/theme';
import { formatStationTime } from '@/utils/format-time';

import { NowHero } from './hero';
import { showHeading, statePill, statusNotice, trackLines, usableNowPlaying } from './now-state';
import { RecentList } from './recent-list';

export function NowScreen() {
  const router = useRouter();
  const player = useLivePlayerContext();
  const nowPlaying = useNowPlaying();
  const recent = useRecent(20);
  const health = useHealth();
  const shows = useShows();

  const online = useIsOnline();
  const scroller = useRef<ScrollView>(null);
  useDevScroll(scroller);

  // An answer saved by an earlier run is not "playing now" while a fresh one is still loading.
  const np = usableNowPlaying({
    data: nowPlaying.data,
    fromEarlierRun: isFromEarlierRun(nowPlaying.dataUpdatedAt),
    fetching: nowPlaying.isFetching,
    offline: !online,
  });
  const heading = showHeading(np);
  const track = trackLines(np?.track);
  const lastGoodAt =
    np && nowPlaying.dataUpdatedAt
      ? formatStationTime(new Date(nowPlaying.dataUpdatedAt).toISOString())
      : null;
  const notice = statusNotice({
    health: health.data,
    offline: !online,
    nowPlayingFailedWithNoData: nowPlaying.isError && !np,
    showingStaleSince: isShowingStale(nowPlaying) ? lastGoodAt : null,
    lastKnownAt: lastGoodAt,
    metadataStale: !!np?.stale,
  });
  const refreshing = nowPlaying.isRefetching && recent.isRefetching;
  const chrome = useBottomChrome({ screen: 'now' });

  // The picture is the show's own artwork when the station has supplied it, otherwise the station's collage.
  const showId = np?.show?.id ?? null;
  const artwork = showId ? shows.data?.shows.find((s) => s.id === showId)?.artwork : null;
  const art = artwork ? { uri: artwork.url } : IMAGES.signal;
  const artLabel = artwork?.alt ?? 'Abstract WJRH live broadcast collage artwork';

  const dimTrack = !track.known || !!np?.stale || !online || isShowingStale(nowPlaying);

  return (
    <View style={styles.root}>
      <FocusedStatusBar style="light" />
      <ScrollView
        ref={scroller}
        contentContainerStyle={{ paddingBottom: chrome.contentPadding }}
        contentInsetAdjustmentBehavior="never"
        refreshControl={
          <RefreshControl
            tintColor={colors.onImage}
            refreshing={refreshing}
            onRefresh={() => {
              void nowPlaying.refetch();
              void recent.refetch();
              void health.refetch();
            }}
          />
        }>
        {/* Pulling down shows the maroon of the picture's top edge, not a cream flash. */}
        <View style={styles.overscroll} pointerEvents="none" />
        <NowHero
          art={art}
          artLabel={artLabel}
          title={heading.title}
          subtitle={heading.subtitle}
          showName={np?.show?.name ?? null}
          onOpenShow={showId ? () => router.push(`/show/${showId}`) : null}
          pill={statePill(heading, health.data?.services.stream.status === 'down')}
          track={track}
          dimTrack={dimTrack}
          playerState={player.state}
          onTogglePlay={player.toggle}
        />

        <View style={styles.recent}>
          {notice ? (
            <View style={styles.notice} accessibilityRole="alert">
              <Text style={styles.noticeText}>{notice}</Text>
            </View>
          ) : null}
          <Text style={styles.heading} accessibilityRole="header">
            Recently played
          </Text>
          {recent.data ? (
            <RecentList items={recent.data.items} />
          ) : (
            <Text style={styles.empty}>
              {recent.isError ? 'Recently played is unavailable right now.' : 'Loading…'}
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  overscroll: { position: 'absolute', top: -1000, left: 0, right: 0, height: 1000, backgroundColor: colors.page },
  recent: { paddingTop: 28, paddingHorizontal: 20, paddingBottom: 24 },
  notice: {
    marginBottom: 18,
    paddingVertical: 14,
    paddingHorizontal: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.rim,
    backgroundColor: colors.surface,
  },
  noticeText: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 19, color: colors.ink },
  heading: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 21, letterSpacing: -0.16, color: colors.ink },
  empty: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, marginTop: 8, color: colors.ink2 },
});
