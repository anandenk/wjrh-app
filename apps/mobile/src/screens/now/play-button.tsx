import { Pressable, StyleSheet, Text } from 'react-native';

import type { LiveState } from '@/audio/use-live-player';
import { colors } from '@/theme';

const LABEL: Record<LiveState, string> = {
  idle: 'Play live',
  connecting: 'Connecting…',
  playing: 'Pause',
  reconnecting: 'Reconnecting…',
};

export function PlayButton({ state, onPress }: { state: LiveState; onPress: () => void }) {
  const busy = state === 'connecting' || state === 'reconnecting';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={state === 'playing' ? 'Pause live stream' : state === 'idle' ? 'Play live stream' : LABEL[state]}
      accessibilityState={{ busy }}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <Text style={styles.glyph}>{state === 'playing' ? '❚❚' : state === 'idle' ? '▶' : '…'}</Text>
      <Text style={styles.label}>{LABEL[state]}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    alignSelf: 'flex-start',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 999,
    backgroundColor: colors.onImage,
  },
  pressed: { opacity: 0.8 },
  glyph: { fontSize: 16, color: colors.live },
  label: { fontSize: 17, fontWeight: '700', color: colors.live },
});
