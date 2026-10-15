import { useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { formatPlaybackTime, type DemoEpisode } from '@/archive/demo-data';
import type { PlayerStatus } from '@/archive/demo-player-state';
import { ChevronLeft, ChevronRight, PlayTriangle, Spinner } from '@/components/icons';
import { Text } from '@/components/text';
import { colors, fonts } from '@/theme';

type Props = {
  episode: DemoEpisode;
  /** Is this episode the one the archive player has loaded? When not, the controls wait for Play. */
  active: boolean;
  status: PlayerStatus;
  position: number;
  onToggle: () => void;
  onSeekBy: (seconds: number) => void;
  onSeekTo: (seconds: number) => void;
};

const SKIP = 30;

/** The controls over the big cover: back 30 s, play/pause, forward 30 s, and a progress bar with the times. */
export function Transport({ episode, active, status, position, onToggle, onSeekBy, onSeekTo }: Props) {
  const [railWidth, setRailWidth] = useState(0);
  const duration = episode.durationSeconds;
  const busy = active && status === 'loading';
  const playing = active && status === 'playing';
  const at = active ? position : 0;
  const ready = active && !busy;
  const what = `${episode.showName} broadcast from ${episode.dateLabel}`;

  const onRailLayout = (e: LayoutChangeEvent) => setRailWidth(e.nativeEvent.layout.width);

  return (
    <View style={styles.root} pointerEvents="box-none">
      <View style={styles.controls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Rewind 30 seconds"
          disabled={!ready}
          onPress={() => onSeekBy(-SKIP)}
          style={({ pressed }) => [styles.skip, !ready && styles.disabled, pressed && styles.pressed]}>
          <ChevronLeft size={14} color={colors.onImage} />
          <Text style={styles.skipText}>{SKIP}</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={busy ? `Loading ${what}` : playing ? `Pause ${what}` : `Play ${what}`}
          accessibilityState={{ busy }}
          disabled={busy}
          onPress={onToggle}
          style={({ pressed }) => [styles.play, pressed && styles.pressed]}>
          <View style={styles.shadow}>
            {busy ? (
              <Spinner size={48} thickness={5} color={colors.onImage} track={colors.onImageFaint} />
            ) : playing ? (
              <View style={styles.pause}>
                <View style={styles.bar} />
                <View style={styles.bar} />
              </View>
            ) : (
              <PlayTriangle size={64} color={colors.onImage} variant="now" />
            )}
          </View>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Forward 30 seconds"
          disabled={!ready}
          onPress={() => onSeekBy(SKIP)}
          style={({ pressed }) => [styles.skip, !ready && styles.disabled, pressed && styles.pressed]}>
          <Text style={styles.skipText}>{SKIP}</Text>
          <ChevronRight size={14} color={colors.onImage} />
        </Pressable>
      </View>

      <View style={styles.progress}>
        <Pressable
          accessibilityRole="adjustable"
          accessibilityLabel={`Seek through ${what}`}
          accessibilityValue={{ text: `${formatPlaybackTime(at)} of ${formatPlaybackTime(duration)}` }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) => onSeekBy(e.nativeEvent.actionName === 'increment' ? SKIP : -SKIP)}
          disabled={!ready}
          onPress={(e) => railWidth > 0 && onSeekTo((e.nativeEvent.locationX / railWidth) * duration)}
          onLayout={onRailLayout}
          style={styles.railTouch}>
          <View style={styles.rail}>
            <View style={[styles.fill, { width: `${Math.min(100, (at / duration) * 100)}%` }]} />
          </View>
        </Pressable>
        <View style={styles.times}>
          <Text style={styles.time}>{formatPlaybackTime(at)}</Text>
          <Text style={styles.time}>{formatPlaybackTime(duration)}</Text>
        </View>
      </View>
    </View>
  );
}

const shadow = { shadowColor: colors.imageShadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 1, shadowRadius: 5 };

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, justifyContent: 'center' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 28 },
  skip: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: colors.onImageMuted,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(31,4,11,0.28)',
  },
  skipText: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 15, color: colors.onImage },
  play: { width: 84, height: 84, alignItems: 'center', justifyContent: 'center' },
  shadow,
  pause: { flexDirection: 'row', gap: 12, alignItems: 'center', justifyContent: 'center' },
  bar: { width: 14, height: 56, backgroundColor: colors.onImage },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.88, transform: [{ scale: 0.96 }] },
  progress: { position: 'absolute', left: 16, right: 16, bottom: 8 },
  railTouch: { height: 40, justifyContent: 'center' },
  rail: { height: 4, borderRadius: 2, overflow: 'hidden', backgroundColor: colors.onImageFaint },
  fill: { height: '100%', backgroundColor: colors.onImage },
  times: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -2 },
  time: {
    fontFamily: fonts.bold,
    fontSize: 11,
    lineHeight: 11,
    fontVariant: ['tabular-nums'],
    color: colors.onImage,
    textShadowColor: colors.imageShadow,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
});
