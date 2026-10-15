import { BlurView } from 'expo-blur';
import { usePathname, useRouter } from 'expo-router';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { useNowPlaying } from '@/api/queries';
import { useLivePlayerContext } from '@/audio/live-player-provider';
import { dockLines } from '@/screens/now/now-state';
import { colors, fonts } from '@/theme';

import { PlayTriangle, Spinner, StopSquare } from './icons';
import { Text } from './text';

/** Where a show page opens from: the Schedule tab's stack when we're in it, otherwise the Now tab's. */
export function showHref(pathname: string, showId: string) {
  return pathname.startsWith('/schedule') ? (`/schedule/${showId}` as const) : (`/show/${showId}` as const);
}

/**
 * The persistent live player, floating above the tab bar on every screen except Now (which has its own big
 * control). A glass strip: blurred content behind a cream tint. Play/stop on the left; the track, and tapping
 * the text opens the show that is on air.
 */
export function PlayerDock() {
  const player = useLivePlayerContext();
  const nowPlaying = useNowPlaying();
  const router = useRouter();
  const pathname = usePathname();

  const np = nowPlaying.data;
  const { title, sub } = dockLines(np);
  const showId = np?.show?.id;
  const busy = player.state === 'connecting' || player.state === 'reconnecting';
  const playing = player.state === 'playing';

  return (
    <View style={styles.dock}>
      {/* Blur only where it is reliable (iOS); Android gets an almost opaque tint instead. */}
      {Platform.OS === 'ios' ? (
        <BlurView intensity={45} tint="light" style={StyleSheet.absoluteFill} />
      ) : null}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: Platform.OS === 'ios' ? colors.playerGlassOverBlur : colors.playerGlassFallback },
        ]}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={playing ? 'Pause live stream' : busy ? 'Connecting to live stream' : 'Play live stream'}
        accessibilityState={{ busy }}
        onPress={player.toggle}
        style={({ pressed }) => [styles.play, pressed && styles.playPressed]}>
        <View style={styles.icon}>
          {busy ? (
            <Spinner size={24} thickness={3} color={colors.live} track={colors.strip} />
          ) : playing ? (
            <StopSquare size={20} color={colors.live} />
          ) : (
            <View style={{ transform: [{ translateX: 1 }] }}>
              <PlayTriangle size={28} color={colors.live} />
            </View>
          )}
        </View>
      </Pressable>
      <Pressable
        accessibilityRole={showId ? 'button' : 'text'}
        accessibilityLabel={
          showId && np?.show ? `Open details for ${np.show.name}. Now playing ${title}, ${sub}` : `${title}, ${sub}`
        }
        disabled={!showId}
        onPress={() => showId && router.push(showHref(pathname, showId))}
        style={({ pressed }) => [styles.meta, pressed && { opacity: 0.64 }]}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {sub}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: colors.rim,
    overflow: 'hidden',
  },
  play: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  playPressed: { opacity: 0.78, transform: [{ scale: 0.96 }] },
  icon: { opacity: 0.88 },
  meta: { flex: 1, minWidth: 0, minHeight: 44, justifyContent: 'center' },
  title: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 15, letterSpacing: -0.13, color: colors.ink },
  sub: { fontFamily: fonts.body, fontSize: 10, lineHeight: 12, marginTop: 1, color: colors.ink, opacity: 0.84 },
});
