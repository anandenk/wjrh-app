import { useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isShowingStale, useWeeklySchedule } from '@/api/queries';
import { useBottomChrome } from '@/components/dock-metrics';
import { useDevScroll } from '@/dev/dev-scroll';
import { FocusedStatusBar } from '@/components/focused-status-bar';
import { DisplayText, Text } from '@/components/text';
import { useNow } from '@/hooks/use-now';
import { WIDE_LAYOUT_MIN_WIDTH, colors, fonts } from '@/theme';
import { formatStationTime } from '@/utils/format-time';

import { freshnessLine, isOnAir, scheduleRows, stationClock, type DayKey } from './schedule-state';
import { SlotRow } from './slot-row';

type TabNavigatorLike = {
  getState(): { routes: { name: string; key: string }[] };
  addListener(type: 'tabPress', cb: (e: { target?: string }) => void): () => void;
};

export function ScheduleScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const narrow = useWindowDimensions().width < WIDE_LAYOUT_MIN_WIDTH;
  const now = useNow();
  const today = stationClock(now).day;

  const weekly = useWeeklySchedule();
  const rows = scheduleRows(weekly.data);
  const chrome = useBottomChrome({ screen: 'other' });

  const notice = weekly.isError && !weekly.data
    ? "Can't load the schedule right now. Pull down to try again."
    : isShowingStale(weekly)
      ? `Showing the last schedule we loaded (${formatStationTime(new Date(weekly.dataUpdatedAt).toISOString())}).`
      : null;

  // Open at today's marker, as the design does, on first showing and whenever the Schedule tab is pressed.
  // (Coming back from a show page keeps your place.)
  const scroller = useRef<ScrollView>(null);
  useDevScroll(scroller);
  const markerY = useRef<Partial<Record<DayKey, number>>>({});
  const scrolledOnce = useRef(false);
  const contentHeight = useRef(0);
  const todayRef = useRef(today);
  useEffect(() => {
    todayRef.current = today;
  });
  const scrollToToday = useCallback((animated: boolean) => {
    const y = markerY.current[todayRef.current];
    if (y !== undefined) scroller.current?.scrollTo({ y, animated });
  }, []);
  // The first scroll needs both today's bar position and the list's full height, and either can arrive first, so both
  // places try.
  const scrollOnFirstLayout = useCallback(() => {
    if (scrolledOnce.current || contentHeight.current === 0 || markerY.current[todayRef.current] === undefined) return;
    scrolledOnce.current = true;
    scrollToToday(false);
  }, [scrollToToday]);
  useEffect(() => {
    // The parent is the tab navigator; its tabPress event is not in this screen's navigation types.
    const tabs = navigation.getParent() as unknown as TabNavigatorLike | undefined;
    const myKey = tabs?.getState().routes.find((r) => r.name === 'schedule')?.key;
    return tabs?.addListener('tabPress', (e) => {
      if (e.target === myKey) requestAnimationFrame(() => scrollToToday(false));
    });
  }, [navigation, scrollToToday]);

  return (
    <View style={styles.root}>
      <FocusedStatusBar style="light" />
      <ScrollView
        ref={scroller}
        stickyHeaderIndices={[0]}
        onContentSizeChange={(_w, h) => {
          contentHeight.current = h;
          scrollOnFirstLayout();
        }}
        contentContainerStyle={{ paddingBottom: chrome.contentPadding }}
        contentInsetAdjustmentBehavior="never"
        refreshControl={
          <RefreshControl tintColor={colors.onImage} refreshing={weekly.isRefetching} onRefresh={() => void weekly.refetch()} />
        }>
        <View style={[styles.masthead, { paddingTop: 24 + insets.top }, narrow && styles.mastheadNarrow]}>
          <DisplayText style={[styles.title, narrow && styles.titleNarrow]} accessibilityRole="header">
            Schedule
          </DisplayText>
          <View style={styles.meta}>
            <Text style={[styles.side, narrow && styles.sideNarrow, styles.numeric]}>104.9 FM</Text>
            <Text style={[styles.side, narrow && styles.sideNarrow]}>TIMES ET</Text>
          </View>
        </View>

        <View>
          {notice ? (
            <View style={styles.notice} accessibilityRole="alert">
              <Text style={styles.noticeText}>{notice}</Text>
            </View>
          ) : null}
          {weekly.isPending ? (
            <Text style={styles.empty}>Loading…</Text>
          ) : rows.length === 0 ? (
            <Text style={styles.empty}>
              {weekly.data ? 'No shows scheduled. WJRH plays automated programming.' : ''}
            </Text>
          ) : (
            rows.map((row) =>
              row.kind === 'day' ? (
                <View
                  key={`day-${row.day}`}
                  style={[styles.dayMarker, narrow && styles.dayMarkerNarrow]}
                  onLayout={(e) => {
                    markerY.current[row.day] = e.nativeEvent.layout.y;
                    scrollOnFirstLayout();
                  }}>
                  <Text style={styles.dayText} accessibilityRole="header">
                    {row.label}
                  </Text>
                </View>
              ) : (
                <SlotRow
                  key={row.slot.id}
                  slot={row.slot}
                  onAir={isOnAir(row.slot, row.day, now)}
                  onPress={() => router.push(`/schedule/${row.slot.showId}`)}
                />
              ),
            )
          )}
          {weekly.data ? <Text style={styles.freshness}>{freshnessLine(weekly.data.generatedAt)}</Text> : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.scheduleBg },
  masthead: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.onImageFaint,
    backgroundColor: colors.scheduleBg,
  },
  mastheadNarrow: { paddingHorizontal: 16 },
  title: {
    fontFamily: fonts.display,
    fontSize: 42,
    lineHeight: 42,
    letterSpacing: 0.42,
    textTransform: 'uppercase',
    color: colors.accentInk,
  },
  titleNarrow: { fontSize: 38, lineHeight: 38, letterSpacing: 0.38 },
  // (An explicit margin, not `gap` on the masthead: the sticky header did not apply that gap.)
  meta: { marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  side: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 11, letterSpacing: 0.66, color: colors.onImageMuted },
  sideNarrow: { fontSize: 10, lineHeight: 10 },
  numeric: { fontVariant: ['tabular-nums', 'lining-nums'] },
  dayMarker: { minHeight: 42, paddingVertical: 12, paddingHorizontal: 20, backgroundColor: colors.accentInk },
  dayMarkerNarrow: { paddingHorizontal: 16 },
  dayText: {
    fontFamily: fonts.bold,
    fontSize: 18,
    lineHeight: 18,
    letterSpacing: -0.18,
    textTransform: 'uppercase',
    color: colors.ink,
  },
  notice: { paddingVertical: 12, paddingHorizontal: 20, backgroundColor: colors.imageOverlayMid },
  noticeText: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 19, color: colors.onImage },
  empty: { padding: 20, fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.onImageMuted },
  freshness: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 4,
    fontFamily: fonts.body,
    fontSize: 11,
    lineHeight: 15,
    color: colors.onImageFaint,
  },
});
