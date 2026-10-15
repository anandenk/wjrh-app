import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { formatDuration, type DemoEpisode } from '@/archive/demo-data';
import { useArchivePlayer } from '@/archive/archive-player-provider';
import { ShowCover } from '@/components/album-cover';
import { PlayTriangle, Spinner, StopSquare } from '@/components/icons';
import { DisplayText, Text } from '@/components/text';
import { colors, fonts, WIDE_LAYOUT_MIN_WIDTH } from '@/theme';

/** One past broadcast: its cover, the show, the date and length, and a play control (the design's "broadcast row"). */
export function BroadcastRow({ episode }: { episode: DemoEpisode }) {
  const player = useArchivePlayer();
  const { width } = useWindowDimensions();
  const narrow = width < WIDE_LAYOUT_MIN_WIDTH;
  const art = narrow ? 80 : 96;

  const active = player.episode?.id === episode.id;
  const busy = active && player.status === 'loading';
  const playing = active && player.status === 'playing';
  const onPress = () => (active ? player.toggle() : player.play(episode));
  const what = `${episode.showName} broadcast from ${episode.dateLabel}`;

  return (
    <View style={[styles.row, narrow && styles.rowNarrow]}>
      <ShowCover slot={episode.coverSlot} style={{ width: art, height: art, backgroundColor: colors.surface2 }} />
      <View style={styles.copy}>
        <DisplayText style={styles.title} numberOfLines={2}>
          {episode.showName}
        </DisplayText>
        <View style={styles.meta}>
          <Text style={styles.metaText}>{episode.dateLabel}</Text>
          <Text style={styles.metaText}>{formatDuration(episode.durationSeconds)}</Text>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={busy ? `Loading ${what}` : playing ? `Pause ${what}` : `Play ${what}`}
        accessibilityState={{ busy }}
        onPress={onPress}
        style={({ pressed }) => [styles.control, narrow && styles.controlNarrow, pressed && styles.pressed]}>
        {busy ? (
          <Spinner size={30} thickness={3} color={colors.accentInk} track={colors.onImageFaint} />
        ) : playing ? (
          <StopSquare size={28} color={colors.accentInk} />
        ) : (
          <PlayTriangle size={38} color={colors.accentInk} />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.onImageFaint,
  },
  rowNarrow: { paddingVertical: 12, paddingHorizontal: 16, gap: 12 },
  copy: { flex: 1, minWidth: 0 },
  title: {
    fontFamily: fonts.display,
    fontSize: 20,
    lineHeight: 20.4,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
    color: colors.accentInk,
  },
  meta: { marginTop: 8, gap: 4 },
  metaText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    lineHeight: 12.5,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.onImageMuted,
  },
  control: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  controlNarrow: { width: 44, height: 44 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.96 }] },
});
