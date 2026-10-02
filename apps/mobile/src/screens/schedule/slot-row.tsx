import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme';

import { formatRange, type Slot } from './schedule-state';

export function SlotRow({ slot, onAir, onPress }: { slot: Slot; onAir: boolean; onPress: () => void }) {
  const range = formatRange(slot.startsAt, slot.endsAt);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${slot.show}, ${range}, with ${slot.dj}${onAir ? ', on air now' : ''}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, onAir && styles.rowOnAir, pressed && styles.pressed]}>
      <View style={styles.text}>
        {onAir ? <Text style={styles.onAir}>ON AIR NOW</Text> : null}
        <Text style={styles.time}>{range}</Text>
        <Text style={styles.show} numberOfLines={2}>
          {slot.show}
        </Text>
        <Text style={styles.dj} numberOfLines={1}>
          {slot.dj ? `with ${slot.dj}` : 'Host to be announced'}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.rim,
  },
  rowOnAir: { borderColor: colors.live, borderWidth: 2 },
  pressed: { opacity: 0.8 },
  text: { flex: 1, gap: 2 },
  onAir: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: colors.live },
  time: { fontSize: 13, fontWeight: '700', color: colors.ink2, fontVariant: ['tabular-nums'] },
  show: { fontSize: 18, fontWeight: '700', color: colors.ink },
  dj: { fontSize: 14, color: colors.ink3 },
  chevron: { fontSize: 24, color: colors.ink3, marginLeft: 8 },
});
