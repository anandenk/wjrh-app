import { Pressable, StyleSheet, View } from 'react-native';

import { PlayTriangle, Spinner, StopSquare } from '@/components/icons';
import type { LiveState } from '@/audio/use-live-player';
import { colors } from '@/theme';

const LABEL: Record<LiveState, string> = {
  idle: 'Play live stream',
  connecting: 'Connecting to live stream',
  playing: 'Pause live stream',
  reconnecting: 'Reconnecting to live stream',
};

/** The big control on the Now hero: a play triangle, a stop square while playing, a ring while connecting. */
export function PlayButton({ state, onPress }: { state: LiveState; onPress: () => void }) {
  const busy = state === 'connecting' || state === 'reconnecting';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={LABEL[state]}
      accessibilityState={{ busy }}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <View style={styles.shadow}>
        {busy ? (
          <Spinner size={38} thickness={4} color={colors.onImage} track={colors.onImageFaint} />
        ) : state === 'playing' ? (
          <StopSquare size={38} color={colors.onImage} />
        ) : (
          <PlayTriangle size={54} color={colors.onImage} variant="now" />
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.88, transform: [{ scale: 0.96 }] },
  // The design's drop-shadow(0 1px 10px) so the control stays readable on any artwork.
  shadow: {
    shadowColor: colors.imageShadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 5,
  },
});
