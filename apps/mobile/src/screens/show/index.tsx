import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRef } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useShows, useWeeklySchedule } from '@/api/queries';
import { demoShowInfo } from '@/archive/demo-show-info';
import { useDemoCover } from '@/archive/use-archive';
import { DetailHeader } from '@/components/detail-header';
import { useBottomChrome } from '@/components/dock-metrics';
import { FocusedStatusBar } from '@/components/focused-status-bar';
import { DisplayText, Text } from '@/components/text';
import { DEMO_ARCHIVES, FEATURES } from '@/config';
import { IMAGES } from '@/content/images';
import { useDevScroll } from '@/dev/dev-scroll';
import { colors, fonts, gradients } from '@/theme';

import { PastBroadcasts } from '../archive/past-broadcasts';
import { airTimes, slotsForShow } from '../schedule/schedule-state';
import { ReminderButton } from './reminder-button';

/**
 * A show's page: the design's "archive detail" layout. "Past broadcasts" appears only in demo mode
 * (FEATURES.archive), with sample recordings; real archives are not built yet.
 */
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
  // Demo mode fills in what the station hasn't written (a sample genre line and description, labelled as such).
  const demo = DEMO_ARCHIVES ? demoShowInfo(showId, name) : null;
  const genres = (show?.genres.length ? show.genres.join(' · ') : first?.genre) || demo?.genres;
  const realDescription = show?.description ?? first?.blurb ?? null;
  const description = realDescription ?? demo?.description ?? null;
  const descriptionIsSample = realDescription === null && demo !== null;
  const bio = show?.hostBio || first?.host.bio || null;
  const times = airTimes(entries);
  // The show's own artwork when the station has supplied it; in demo mode a placeholder cover; else the collage.
  const demoCover = useDemoCover(showId);
  const art = show?.artwork ? { uri: show.artwork.url } : (demoCover ?? IMAGES.signal);
  const artLabel =
    show?.artwork?.alt ??
    (demoCover ? 'Placeholder album cover, not the show’s own artwork' : 'Abstract WJRH live broadcast collage artwork');
  // clamp(38px, 11vw, 52px)
  const nameSize = Math.min(52, Math.max(38, width * 0.11));

  return (
    <View style={styles.root}>
      <FocusedStatusBar style="light" />
      <DetailHeader backLabel={backLabel} title="SHOW" fallback={backLabel === 'NOW' ? '/' : '/schedule'} />
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
              <Image source={art} placeholder={IMAGES.signal} transition={250} accessibilityLabel={artLabel} contentFit="cover" style={StyleSheet.absoluteFill} />
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
              <Text style={styles.note}>{descriptionIsSample ? 'Sample description' : 'About the show'}</Text>
              <Text style={styles.description}>
                {description ?? "The station hasn't added a description for this show yet."}
              </Text>
            </View>

            {FEATURES.archive ? <PastBroadcasts showId={showId} linkToArchive /> : null}

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
