import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { demoShowInfo } from '@/archive/demo-show-info';
import { DisplayText, Text } from '@/components/text';
import { DEMO_ARCHIVES } from '@/config';
import { WIDE_LAYOUT_MIN_WIDTH, colors, fonts } from '@/theme';

import { formatRange24, type Slot } from './schedule-state';

/** One show in the week's list: its hours, its name in the display face, its host and genre. */
export function SlotRow({ slot, onAir, onPress }: { slot: Slot; onAir: boolean; onPress: () => void }) {
  const narrow = useWindowDimensions().width < WIDE_LAYOUT_MIN_WIDTH;
  const range = formatRange24(slot.startsAt, slot.endsAt);
  // Demo mode gives a show the calendar has no genre for a sample one, so the list reads as complete.
  const genre = slot.genre || (DEMO_ARCHIVES ? demoShowInfo(slot.showId, slot.show).genres : '');
  const meta = slot.dj ? (genre ? `${slot.dj} · ${genre}` : slot.dj) : 'Host to be announced';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open show page for ${slot.show}, ${range}${slot.dj ? `, with ${slot.dj}` : ''}${onAir ? ', on air now' : ''}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        narrow && styles.rowNarrow,
        onAir && styles.onAirRow,
        pressed && styles.pressed,
      ]}>
      <Text style={[styles.time, narrow && styles.timeNarrow]}>{range}</Text>
      <View style={styles.copy}>
        <DisplayText style={[styles.title, narrow && styles.titleNarrow]}>{slot.show}</DisplayText>
        <Text style={styles.meta}>{meta}</Text>
        {onAir ? (
          <View style={styles.live}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>ON AIR NOW</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 64, paddingVertical: 12, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'flex-start' },
  rowNarrow: { paddingHorizontal: 16 },
  onAirRow: { backgroundColor: colors.imageOverlayMid },
  pressed: { backgroundColor: colors.scheduleHover },
  // The time column is 84px wide with a 16px gap (12px on narrow phones).
  time: {
    width: 100,
    paddingTop: 2,
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 14,
    fontVariant: ['tabular-nums', 'lining-nums'],
    color: colors.onImageMuted,
  },
  timeNarrow: { width: 96 },
  copy: { flex: 1, minWidth: 0 },
  title: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 22.4,
    letterSpacing: 0.22,
    textTransform: 'uppercase',
    color: colors.accentInk,
  },
  titleNarrow: { fontSize: 20, lineHeight: 20.4, letterSpacing: 0.2 },
  meta: { marginTop: 4, fontFamily: fonts.body, fontSize: 12, lineHeight: 15, color: colors.onImageMuted },
  live: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.logoGold },
  liveText: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 11, letterSpacing: 0.88, color: colors.logoGold },
});
