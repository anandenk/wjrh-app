import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useRef, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useHealth, useNowPlaying } from '@/api/queries';
import { useBottomChrome } from '@/components/dock-metrics';
import { FocusedStatusBar } from '@/components/focused-status-bar';
import { ChevronLeft, ChevronRight, ExternalLinkIcon } from '@/components/icons';
import { Logo } from '@/components/logo';
import { DisplayText, Text } from '@/components/text';
import { IMAGES } from '@/content/images';
import { useDevScroll } from '@/dev/dev-scroll';
import { type Cta, type Hero } from '@/content/station';
import { colors, fonts } from '@/theme';

import { openLink } from './open-link';

/** Horizontal room inside a Station screen (the design's .station-screen padding). */
export const PAGE_PADDING = 20;

/** The cream Station screen: the station header, optional back link, then the page, over the docks' room. */
export function StationFrame({ children, back }: { children: ReactNode; back?: boolean }) {
  const chrome = useBottomChrome({ screen: 'station' });
  const scroller = useRef<ScrollView>(null);
  useDevScroll(scroller);
  return (
    <View style={styles.root}>
      <FocusedStatusBar style="dark" />
      <ScrollView ref={scroller} contentContainerStyle={{ paddingBottom: chrome.contentPadding }} contentInsetAdjustmentBehavior="never">
        <StationHeader />
        <View style={styles.page}>
          {back ? <BackLink /> : null}
          {children}
        </View>
      </ScrollView>
    </View>
  );
}

/** Logo, then "104.9 FM ● Lafayette College Radio" (the dot is the on-air color). */
function StationHeader() {
  const insets = useSafeAreaInsets();
  const nowPlaying = useNowPlaying();
  const health = useHealth();
  const down = health.data?.services.stream.status === 'down';
  const dot = down ? colors.off : nowPlaying.data?.automation && !nowPlaying.data.live ? colors.idle : colors.live;
  return (
    <View style={[styles.header, { paddingTop: 24 + insets.top }]}>
      <Logo />
      <View style={styles.headerLine}>
        <Text style={styles.freq}>104.9 FM</Text>
        <View style={[styles.dot, { backgroundColor: dot }]} />
        <Text style={styles.tagline}>Lafayette College Radio</Text>
      </View>
    </View>
  );
}

function BackLink() {
  const router = useRouter();
  return (
    <View style={styles.backRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back to Station"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/station'))}
        style={({ pressed }) => [styles.back, pressed && { opacity: 0.78 }]}>
        <ChevronLeft size={16} color={colors.ink2} />
        <Text style={styles.backText}>Station</Text>
      </Pressable>
    </View>
  );
}

/** The kicker and the big title that open a Station page. */
export function PageTitle({ kicker, title }: { kicker: string; title: string }) {
  return (
    <>
      <Text style={styles.kicker}>{kicker}</Text>
      <DisplayText style={styles.pageTitle} accessibilityRole="header">
        {title}
      </DisplayText>
    </>
  );
}

/** A page's photo, 190 tall with the design's crop, and its credit line. */
export function PageHero({ hero }: { hero: Hero }) {
  return (
    <>
      <View style={styles.infoHero}>
        <Image
          source={IMAGES[hero.image]}
          accessibilityLabel={hero.alt}
          contentFit="cover"
          contentPosition={{ top: `${hero.y ?? 50}%` }}
          style={StyleSheet.absoluteFill}
        />
      </View>
      {hero.credit ? <Text style={styles.credit}>{hero.credit}</Text> : null}
    </>
  );
}

export function SectionLabel({ children }: { children: string }) {
  return (
    <Text style={styles.sectionLabel} accessibilityRole="header">
      {children}
    </Text>
  );
}

export function BodyText({ children, flush }: { children: ReactNode; flush?: boolean }) {
  return <Text style={[styles.copy, flush && { marginTop: 0 }]}>{children}</Text>;
}

/** A pill button: solid maroon (primary) or cream with a rim (secondary); an arrow-out icon when it leaves the app. */
export function CtaButton({ cta, top = 0 }: { cta: Cta; top?: number }) {
  const router = useRouter();
  const primary = cta.variant === 'primary';
  const external = !!cta.url && /^https?:/.test(cta.url);
  const color = primary ? colors.accentInk : colors.live;
  const onPress = () => {
    if (cta.url) openLink(cta.url);
    else if (cta.schedule) router.navigate('/schedule');
    else if (cta.page) router.push(`/station/${cta.page}`);
  };
  return (
    <Pressable
      accessibilityRole={cta.url ? 'link' : 'button'}
      accessibilityLabel={cta.label}
      onPress={onPress}
      style={({ pressed }) => [styles.cta, primary ? styles.ctaPrimary : styles.ctaSecondary, { marginTop: top }, pressed && { opacity: 0.78 }]}>
      <Text style={[styles.ctaText, { color }]}>{cta.label}</Text>
      {external ? (
        <View style={{ marginLeft: 6 }}>
          <ExternalLinkIcon size={14} color={color} />
        </View>
      ) : null}
    </Pressable>
  );
}

/** A full-width row with a chevron: the hub's "Explore WJRH" and a page's "Keep exploring". */
export function RowLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.rowLink, pressed && { opacity: 0.78 }]}>
      <Text style={styles.rowLinkText}>{label}</Text>
      <ChevronRight size={18} color={colors.live} />
    </Pressable>
  );
}

/** Two-column cards with a big display-face figure over a small caption. */
export function FactGrid({ items }: { items: { big: string; small: string }[] }) {
  const { width } = useWindowDimensions();
  const cell = (width - PAGE_PADDING * 2 - 8) / 2;
  return (
    <View style={styles.facts}>
      {items.map((f) => (
        <View key={f.big} style={[styles.fact, { width: cell }]}>
          <DisplayText style={styles.factBig}>{f.big}</DisplayText>
          <Text style={styles.factSmall}>{f.small}</Text>
        </View>
      ))}
    </View>
  );
}

/** A ruled list of title + small line (history timeline, event archive). */
export function InfoList({ items, top = 18 }: { items: { title: string; meta: string }[]; top?: number }) {
  return (
    <View style={[styles.infoList, { marginTop: top }]}>
      {items.map((it) => (
        <View key={`${it.title}-${it.meta}`} style={styles.infoItem}>
          <Text style={styles.infoTitle}>{it.title}</Text>
          <Text style={styles.infoMeta}>{it.meta}</Text>
        </View>
      ))}
    </View>
  );
}

export function SmallNote({ children, top = 12 }: { children: ReactNode; top?: number }) {
  return <Text style={[styles.credit, { marginTop: top }]}>{children}</Text>;
}

export const stationText = StyleSheet.create({
  meta: { marginTop: 4, fontFamily: fonts.body, fontSize: 12, lineHeight: 16.8, color: colors.ink3 },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  page: { paddingHorizontal: PAGE_PADDING },
  header: { paddingHorizontal: PAGE_PADDING, paddingBottom: 18 },
  headerLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 9 },
  freq: {
    fontFamily: fonts.bold,
    fontSize: 13,
    lineHeight: 13,
    letterSpacing: -0.26,
    fontVariant: ['tabular-nums', 'lining-nums'],
    color: colors.ink2,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  tagline: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 12, letterSpacing: 0.24, color: colors.ink3 },
  backRow: { paddingTop: 4, paddingBottom: 16, flexDirection: 'row', alignItems: 'center' },
  back: { minHeight: 44, paddingVertical: 10, paddingRight: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  backText: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 12, letterSpacing: 0.48, color: colors.ink2 },
  kicker: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 17.55, color: colors.live },
  pageTitle: {
    marginTop: 8,
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 34,
    letterSpacing: 0.34,
    textTransform: 'uppercase',
    color: colors.ink,
  },
  infoHero: {
    marginTop: 18,
    height: 190,
    overflow: 'hidden',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.rim,
    backgroundColor: colors.surface2,
  },
  credit: { marginTop: 7, fontFamily: fonts.body, fontSize: 12, lineHeight: 16.8, color: colors.ink3 },
  sectionLabel: {
    marginTop: 26,
    marginBottom: 10,
    fontFamily: fonts.bold,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: -0.16,
    color: colors.ink,
  },
  copy: { marginTop: 16, fontFamily: fonts.body, fontSize: 14, lineHeight: 22.7, color: colors.ink2 },
  cta: {
    minHeight: 48,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
  },
  ctaPrimary: { backgroundColor: colors.live, borderColor: 'transparent' },
  ctaSecondary: { backgroundColor: colors.surface, borderColor: colors.rim },
  ctaText: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 16 },
  rowLink: {
    minHeight: 56,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.rim,
  },
  rowLinkText: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 17, color: colors.ink },
  facts: { marginTop: 18, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fact: {
    minHeight: 76,
    padding: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.rim,
    backgroundColor: colors.surface,
  },
  factBig: {
    fontFamily: fonts.display,
    fontSize: 25,
    lineHeight: 25,
    textTransform: 'uppercase',
    fontVariant: ['tabular-nums'],
    color: colors.live,
  },
  factSmall: { marginTop: 5, fontFamily: fonts.bold, fontSize: 12, lineHeight: 15.6, color: colors.ink3 },
  infoList: { borderTopWidth: 1, borderTopColor: colors.rim },
  infoItem: { paddingVertical: 14, paddingHorizontal: 2, borderBottomWidth: 1, borderBottomColor: colors.rim },
  infoTitle: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 17, color: colors.ink },
  infoMeta: { marginTop: 4, fontFamily: fonts.body, fontSize: 12, lineHeight: 16.8, color: colors.ink3 },
});
