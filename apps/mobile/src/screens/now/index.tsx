import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { isFromEarlierRun } from '@/api/cache-rules';
import { isShowingStale, useHealth, useNowPlaying, useRecent } from '@/api/queries';
import { useLivePlayerContext } from '@/audio/live-player-provider';
import { useIsOnline } from '@/hooks/use-online';
import { colors } from '@/theme';
import { formatStationTime } from '@/utils/format-time';

import { showHeading, statusNotice, trackLines, usableNowPlaying } from './now-state';
import { PlayButton } from './play-button';
import { RecentList } from './recent-list';

export function NowScreen() {
  const player = useLivePlayerContext();
  const nowPlaying = useNowPlaying();
  const recent = useRecent(20);
  const health = useHealth();

  const online = useIsOnline();

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

  return (
    <ScrollView
      style={styles.root}
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            void nowPlaying.refetch();
            void recent.refetch();
            void health.refetch();
          }}
        />
      }>
      <View style={styles.hero}>
        {heading.badge ? (
          <View style={styles.badge}>
            <View style={[styles.dot, heading.badge === 'AUTOMATED' && styles.dotIdle]} />
            <Text style={styles.badgeText}>{heading.badge}</Text>
          </View>
        ) : null}
        <Text style={styles.showTitle} accessibilityRole="header">
          {heading.title}
        </Text>
        {heading.subtitle ? <Text style={styles.showSub}>{heading.subtitle}</Text> : null}

        <View style={[styles.track, (!track.known || np?.stale || !online || isShowingStale(nowPlaying)) && styles.dim]}>
          <Text style={styles.trackLabel}>NOW PLAYING</Text>
          <Text style={styles.trackTitle} numberOfLines={2}>
            {track.title}
          </Text>
          {track.artist ? <Text style={styles.trackSub}>{track.artist}</Text> : null}
          {track.album ? <Text style={styles.trackSub}>{track.album}</Text> : null}
        </View>

        <PlayButton state={player.state} onPress={player.toggle} />
        {np?.nextShow ? (
          <Text style={styles.next}>
            Up next: {np.nextShow.name} at {formatStationTime(np.nextShow.startsAt)}
          </Text>
        ) : null}
      </View>

      {notice ? (
        <View style={styles.notice} accessibilityRole="alert">
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
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
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  hero: { backgroundColor: colors.page, padding: 24, paddingTop: 72, gap: 10 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,243,215,0.14)',
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#FAC165' },
  dotIdle: { backgroundColor: colors.off },
  badgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: colors.onImage },
  showTitle: { fontSize: 36, fontWeight: '800', color: colors.onImage },
  showSub: { fontSize: 15, color: 'rgba(255,243,215,0.8)' },
  track: { marginVertical: 14, gap: 3 },
  dim: { opacity: 0.6 },
  trackLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, color: 'rgba(255,243,215,0.62)' },
  trackTitle: { fontSize: 20, fontWeight: '700', color: colors.onImage },
  trackSub: { fontSize: 15, color: 'rgba(255,243,215,0.8)' },
  next: { fontSize: 13, color: 'rgba(255,243,215,0.8)', marginTop: 4 },
  notice: { backgroundColor: colors.surface2, paddingVertical: 10, paddingHorizontal: 24 },
  noticeText: { fontSize: 13, fontWeight: '600', color: colors.ink },
  section: { padding: 24, gap: 12 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: colors.ink },
  empty: { fontSize: 14, color: colors.ink2 },
});
