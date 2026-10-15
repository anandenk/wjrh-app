import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useShows, useWeeklySchedule } from '@/api/queries';
import { useBottomChrome } from '@/components/dock-metrics';
import { FocusedStatusBar } from '@/components/focused-status-bar';
import { ChevronLeft } from '@/components/icons';
import { DisplayText, Text } from '@/components/text';
import { IMAGES } from '@/content/images';
import { useDevScroll } from '@/dev/dev-scroll';
import { colors, fonts, gradients } from '@/theme';

import { airTimes, slotsForShow } from '../schedule/schedule-state';
import { ReminderButton } from './reminder-button';

/** A show's page: the design's "archive detail" layout, without the archive (Archive is not built yet). */
export function ShowScreen({ showId, backLabel }: { showId: string; backLabel: 'NOW' | 'SCHEDULE' }) {
  const shows = useShows();
  const weekly = useWeeklySchedule();
  const chrome = useBottomChrome({ screen: 'other' });
  const { width } = useWindowDimensions();
  const scroller = useRef<ScrollView>(null);
  useDevScroll(scroller);

  const show = shows.data?.shows.find((s) => s.id === showId);
  const entries = slotsForShow(weekly.data, showId);
  const first = entries[0]?.slot;

  const loading = (shows.isPending || weekly.isPending) && !show && !first;
  const missing = !loading && !show && !first;

  const name = show?.name ?? first?.show ?? '';
  const hosts = show?.hostNames.length ? show.hostNames.join(', ') : first?.dj;
  const genres = show?.genres.length ? show.genres.join(' · ') : first?.genre;
  const description = show?.description ?? first?.blurb ?? null;
  const bio = show?.hostBio || first?.host.bio || null;
  const times = airTimes(entries);
  const art = show?.artwork ? { uri: show.artwork.url } : IMAGES.signal;
  const artLabel = show?.artwork?.alt ?? 'Abstract WJRH live broadcast collage artwork';
  // clamp(38px, 11vw, 52px)
  const nameSize = Math.min(52, Math.max(38, width * 0.11));

  return (
    <View style={styles.root}>
      <FocusedStatusBar style="light" />
      <ShowHeader backLabel={backLabel} />
      <ScrollView ref={scroller} contentContainerStyle={{ paddingBottom: chrome.contentPadding }} contentInsetAdjustmentBehavior="never">
        {loading || missing ? (
          <Text style={styles.status}>
            {loading
              ? 'Loading…'
              : shows.isError || weekly.isError
                ? "Can't load this show right now. Go back and try again."
                : "We couldn't find this show."}
          </Text>
        ) : (
          <>
            <View style={[styles.hero, { height: width }]}>
              <Image source={art} accessibilityLabel={artLabel} contentFit="cover" style={StyleSheet.absoluteFill} />
              <LinearGradient {...gradients.showShade} style={StyleSheet.absoluteFill} pointerEvents="none" />
            </View>

            <View style={styles.copy}>
              <Text style={styles.kicker}>{genres ? genres : 'Show'}</Text>
              <DisplayText
                style={[styles.name, { fontSize: nameSize, lineHeight: nameSize * 0.96, letterSpacing: nameSize * 0.01 }]}
                accessibilityRole="header">
                {name}
              </DisplayText>
              {hosts ? <Text style={styles.host}>with {hosts}</Text> : null}
              <Text style={styles.note}>About the show</Text>
              <Text style={styles.description}>
                {description ?? "The station hasn't added a description for this show yet."}
              </Text>
            </View>

            <View style={styles.section}>
              <DisplayText style={styles.heading} accessibilityRole="header">
                On air
              </DisplayText>
              <View style={styles.list}>
                {times.length ? (
                  times.map((t) => (
                    <View key={t} style={styles.listRow}>
                      <Text style={styles.listText}>{t}</Text>
                    </View>
                  ))
                ) : (
                  <View style={styles.listRow}>
                    <Text style={styles.listText}>Not on this week&apos;s schedule.</Text>
                  </View>
                )}
              </View>
              {times.length ? <ReminderButton showId={showId} showName={name} /> : null}
            </View>

            {bio ? (
              <View style={styles.section}>
                <DisplayText style={styles.heading} accessibilityRole="header">
                  About the host
                </DisplayText>
                <Text style={styles.bio}>{bio}</Text>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

/** Back (with where it goes), the page's label in the display face, and the frequency. */
function ShowHeader({ backLabel }: { backLabel: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const goBack = () => (router.canGoBack() ? router.back() : router.replace(backLabel === 'NOW' ? '/' : '/schedule'));
  return (
    <View style={[styles.header, { paddingTop: 8 + insets.top }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Back to ${backLabel.charAt(0) + backLabel.slice(1).toLowerCase()}`}
        onPress={goBack}
        hitSlop={{ right: 12 }}
        style={({ pressed }) => [styles.back, pressed && { opacity: 0.78 }]}>
        <ChevronLeft size={16} color={colors.accentInk} />
        <Text style={styles.backText}>{backLabel}</Text>
      </Pressable>
      <DisplayText style={styles.headerTitle}>SHOW</DisplayText>
      <Text style={styles.frequency}>104.9 FM</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.scheduleBg },
  header: {
    minHeight: 60,
    paddingBottom: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.onImageFaint,
    backgroundColor: colors.scheduleBg,
  },
  back: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 8 },
  backText: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 11, letterSpacing: 0.77, color: colors.accentInk },
  headerTitle: { fontFamily: fonts.display, fontSize: 24, lineHeight: 24, letterSpacing: 0.24, color: colors.accentInk },
  frequency: {
    flex: 1,
    textAlign: 'right',
    fontFamily: fonts.bold,
    fontSize: 10,
    lineHeight: 10,
    letterSpacing: 0.6,
    color: colors.onImageMuted,
  },
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
  section: { paddingTop: 22, paddingBottom: 4 },
  heading: {
    paddingHorizontal: 20,
    marginBottom: 14,
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 28,
    letterSpacing: 0.28,
    textTransform: 'uppercase',
    color: colors.accentInk,
  },
  list: { borderTopWidth: 1, borderTopColor: colors.onImageFaint },
  listRow: { paddingVertical: 16, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: colors.onImageFaint },
  listText: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 19, color: colors.accentInk },
  bio: { paddingHorizontal: 20, fontFamily: fonts.body, fontSize: 13, lineHeight: 20, color: colors.onImageMuted },
});
