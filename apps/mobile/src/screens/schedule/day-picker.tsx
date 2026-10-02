import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { colors } from '@/theme';

import { DAY_KEYS, DAY_LONG, DAY_SHORT, type DayKey } from './schedule-state';

export function DayPicker({
  selected,
  today,
  onSelect,
}: {
  selected: DayKey;
  today: DayKey;
  onSelect: (day: DayKey) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {DAY_KEYS.map((day) => {
        const active = day === selected;
        return (
          <Pressable
            key={day}
            accessibilityRole="button"
            accessibilityLabel={`${DAY_LONG[day]}${day === today ? ', today' : ''}`}
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(day)}
            style={[styles.chip, active && styles.chipActive]}>
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{DAY_SHORT[day]}</Text>
            {day === today ? <Text style={[styles.today, active && styles.chipTextActive]}>TODAY</Text> : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  chip: {
    minWidth: 56,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.page },
  chipText: { fontSize: 15, fontWeight: '700', color: colors.ink },
  chipTextActive: { color: colors.onImage },
  today: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8, color: colors.live, marginTop: 1 },
});
