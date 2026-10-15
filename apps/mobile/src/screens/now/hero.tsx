import { Image, type ImageSource } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { LiveState } from '@/audio/use-live-player';
import { Logo } from '@/components/logo';
import { DisplayText, Text } from '@/components/text';
import { colors, fonts, gradients } from '@/theme';

import type { StatePill, TrackLines } from './now-state';
import { PlayButton } from './play-button';

const DOT: Record<StatePill['tone'], string> = { live: colors.logoGold, idle: colors.idle, off: colors.off };

type Props = {
  art: ImageSource;
  artLabel: string;
  title: string;
  subtitle: string | null;
  /** Set when the show on air has a page: the title then opens it. */
  onOpenShow: (() => void) | null;
  showName: string | null;
  pill: StatePill | null;
  track: TrackLines;
  dimTrack: boolean;
  playerState: LiveState;
  onTogglePlay: () => void;
};

/**
 * The square "live canvas" at the top of Now: the show's picture with a dark gradient, the logo and state
 * pill on top, the show's name and host, and the play control beside the track that is playing.
 */
export function NowHero(p: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // clamp(34px, 10vw, 46px); the design caps the title at 11ch, which is 5.016 em in this face.
  const titleSize = Math.min(46, Math.max(34, width * 0.1));

  const heading = (
    <>
      <DisplayText style={[styles.title, shadow, { fontSize: titleSize, lineHeight: titleSize * 1.02, letterSpacing: titleSize * 0.01, maxWidth: titleSize * 5.016 }]}>
        {p.title.replace('104.9 FM', '104.9\u00a0FM')}
      </DisplayText>
      {p.subtitle ? <Text style={[styles.host, hostShadow]}>{p.subtitle}</Text> : null}
    </>
  );

  return (
    <View style={[styles.canvas, { height: Math.max(320, width) }]}>
      <Image source={p.art} accessibilityLabel={p.artLabel} contentFit="cover" style={StyleSheet.absoluteFill} />
      <LinearGradient {...gradients.now} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={[styles.content, { paddingTop: 24 + insets.top }]}>
        <View style={styles.top}>
          <Logo />
          {p.pill ? (
            <View style={styles.pill} accessibilityRole="text" accessibilityLabel={p.pill.label}>
              <View style={[styles.pillDot, { backgroundColor: DOT[p.pill.tone] }]} />
              <Text style={styles.pillText}>{p.pill.label}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.lower}>
          {p.onOpenShow ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open details for ${p.showName ?? p.title}`}
              onPress={p.onOpenShow}
              style={({ pressed }) => pressed && { opacity: 0.88 }}>
              {heading}
            </Pressable>
          ) : (
            <View>{heading}</View>
          )}

          <View style={styles.trackRow}>
            <PlayButton state={p.playerState} onPress={p.onTogglePlay} />
            <View style={[styles.track, p.dimTrack && styles.dim]}>
              <Text style={styles.trackLabel}>NOW PLAYING</Text>
              <Text style={[styles.trackTitle, hostShadow]} numberOfLines={1}>
                {p.track.title}
              </Text>
              {p.track.artist ? (
                <Text style={[styles.trackArtist, smallShadow]} numberOfLines={1}>
                  {p.track.artist}
                </Text>
              ) : null}
              {/* The licence asks for the album too (CLAUDE.md, Rules); the design leaves it out. */}
              {p.track.album ? (
                <Text style={[styles.trackAlbum, smallShadow]} numberOfLines={1}>
                  {p.track.album}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

// CSS text-shadow "0 2px 18px", "0 1px 12px", "0 1px 10px" in the design's image-shadow color.
const shadow = { textShadowColor: colors.imageShadow, textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 12 };
const hostShadow = { textShadowColor: colors.imageShadow, textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 8 };
const smallShadow = { textShadowColor: colors.imageShadow, textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 7 };

const styles = StyleSheet.create({
  canvas: { width: '100%', overflow: 'hidden', backgroundColor: colors.surface2 },
  content: { ...StyleSheet.absoluteFill, paddingHorizontal: 20, paddingBottom: 20, justifyContent: 'space-between' },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  pill: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 11,
    borderWidth: 1,
    borderColor: colors.recentOutline,
    borderRadius: 999,
    backgroundColor: colors.imageOverlayMid,
  },
  pillDot: { width: 7, height: 7, borderRadius: 4 },
  pillText: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 13, letterSpacing: 0.99, color: colors.onImage },
  lower: { gap: 18 },
  title: { fontFamily: fonts.display, textTransform: 'uppercase', color: colors.onImage },
  host: { fontFamily: fonts.body, fontSize: 14, lineHeight: 19, marginTop: 7, color: colors.onImageMuted },
  trackRow: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  track: { flex: 1, minWidth: 0 },
  dim: { opacity: 0.6 },
  trackLabel: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 11, letterSpacing: 1.1, color: colors.onImageFaint },
  trackTitle: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 21, letterSpacing: -0.18, marginTop: 7, color: colors.onImage },
  trackArtist: { fontFamily: fonts.body, fontSize: 13, lineHeight: 16, marginTop: 4, color: colors.onImageMuted },
  trackAlbum: { fontFamily: fonts.body, fontSize: 12, lineHeight: 15, marginTop: 2, color: colors.onImageFaint },
});
