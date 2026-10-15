import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { FacebookGlyph, InstagramGlyph, TwitterGlyph } from '@/components/icons';
import { DisplayText, Text } from '@/components/text';
import { IMAGES } from '@/content/images';
import { HUB_ROWS, HUB_TILES, SOCIAL_LINKS, STATION_INTRO } from '@/content/station';
import { WIDE_LAYOUT_MIN_WIDTH, colors, fonts, gradients } from '@/theme';

import { openLink } from './open-link';
import { PAGE_PADDING, RowLink, SectionLabel, StationFrame } from './ui';

export function StationScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  // Two photo tiles side by side from 400px up (the design's 25rem breakpoint); stacked below that.
  const half = width >= WIDE_LAYOUT_MIN_WIDTH ? (width - PAGE_PADDING * 2 - 10) / 2 : '100%';

  return (
    <StationFrame>
      <View style={styles.hero}>
        <Image
          source={IMAGES.home}
          accessibilityLabel="WJRH student leadership gathered on Lafayette College’s campus"
          contentFit="cover"
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient {...gradients.hero} style={StyleSheet.absoluteFill} pointerEvents="none" />
        <View style={styles.heroCopy}>
          <Text style={styles.heroKicker}>Lafayette College · Easton, PA</Text>
          <DisplayText style={styles.heroTitle} accessibilityRole="header">
            Student-run since 1946
          </DisplayText>
        </View>
      </View>
      <Text style={styles.credit}>Photograph by Jaquan Alston · Liz, Taylor, Asa, Eva, Kate, and Kendal</Text>
      <Text style={styles.intro}>{STATION_INTRO}</Text>

      <SectionLabel>Get closer to the signal</SectionLabel>
      <View style={styles.grid}>
        {HUB_TILES.map((t) => (
          <Pressable
            key={t.slug}
            accessibilityRole="button"
            accessibilityLabel={`${t.title}. ${t.sub}`}
            onPress={() => router.push(`/station/${t.slug}`)}
            style={({ pressed }) => [styles.tile, { width: t.wide ? '100%' : half, height: t.wide ? 150 : 126 }, pressed && { opacity: 0.88 }]}>
            <Image source={IMAGES[t.image]} contentFit="cover" style={StyleSheet.absoluteFill} />
            <LinearGradient {...gradients.tile} style={StyleSheet.absoluteFill} pointerEvents="none" />
            <View style={styles.tileCopy}>
              <DisplayText style={styles.tileTitle} numberOfLines={1}>
                {t.title}
              </DisplayText>
              <Text style={styles.tileSub}>{t.sub}</Text>
            </View>
          </Pressable>
        ))}
      </View>

      <SectionLabel>Explore WJRH</SectionLabel>
      <View>
        {HUB_ROWS.map((r) => (
          <RowLink key={r.slug} label={r.label} onPress={() => router.push(`/station/${r.slug}`)} />
        ))}
      </View>

      <SectionLabel>Follow & verify</SectionLabel>
      <View style={styles.social} accessibilityLabel="WJRH social media and public records">
        {SOCIAL_LINKS.map((s) => (
          <Pressable
            key={s.id}
            accessibilityRole="link"
            accessibilityLabel={s.label}
            onPress={() => openLink(s.url)}
            style={({ pressed }) => [styles.socialButton, pressed && { opacity: 0.78, transform: [{ scale: 0.96 }] }]}>
            {s.id === 'instagram' ? (
              <InstagramGlyph size={31} color={colors.logoGold} />
            ) : s.id === 'facebook' ? (
              <FacebookGlyph size={31} color={colors.logoGold} />
            ) : s.id === 'twitter' ? (
              <TwitterGlyph size={31} color={colors.logoGold} />
            ) : (
              <Text style={styles.fcc}>FCC</Text>
            )}
          </Pressable>
        ))}
      </View>
    </StationFrame>
  );
}

const styles = StyleSheet.create({
  hero: {
    height: 216, // 214 plus the 1px borders (the design's box is content-sized)
    overflow: 'hidden',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.rim,
    backgroundColor: colors.surface2,
  },
  heroCopy: { position: 'absolute', left: 18, right: 18, bottom: 17 },
  heroKicker: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 17.5, color: colors.onImage },
  heroTitle: {
    marginTop: 7,
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 34,
    letterSpacing: 0.34,
    textTransform: 'uppercase',
    color: colors.onImage,
  },
  credit: { marginTop: 7, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.ink3 },
  intro: { marginTop: 16, fontFamily: fonts.body, fontSize: 15, lineHeight: 23.7, color: colors.ink2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { overflow: 'hidden', borderRadius: 12, borderWidth: 1, borderColor: colors.rim, backgroundColor: colors.surface },
  tileCopy: { position: 'absolute', left: 13, right: 13, bottom: 12 },
  tileTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 23,
    letterSpacing: 0.22,
    textTransform: 'uppercase',
    color: colors.onImage,
  },
  tileSub: { marginTop: 4, fontFamily: fonts.body, fontSize: 12, lineHeight: 15.6, color: colors.onImageMuted },
  social: { marginTop: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 18 },
  socialButton: {
    width: 58, // 56 plus the 1px borders
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.liveLine,
    backgroundColor: colors.live,
  },
  fcc: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 14, letterSpacing: 0.84, color: colors.logoGold },
});
