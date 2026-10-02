import { StyleSheet, Text, View } from 'react-native';

import type { Recent } from '@/api/types';
import { colors } from '@/theme';
import { formatStationTime } from '@/utils/format-time';

export function RecentList({ items }: { items: Recent['items'] }) {
  if (items.length === 0) {
    return <Text style={styles.empty}>Nothing played yet.</Text>;
  }
  return (
    <View style={styles.list}>
      {items.map((t) => (
        <View key={t.id} style={styles.row}>
          <View style={styles.text}>
            <Text style={styles.title} numberOfLines={1}>
              {t.title ?? 'Track title unavailable'}
            </Text>
            <Text style={[styles.artist, !t.artist && styles.faint]} numberOfLines={1}>
              {t.artist ?? 'Artist metadata unavailable'}
            </Text>
          </View>
          <Text style={styles.time}>{formatStationTime(t.startedAt)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 10,
    backgroundColor: colors.page,
  },
  text: { flex: 1 },
  title: { fontSize: 15, fontWeight: '600', color: colors.onImage },
  artist: { fontSize: 12, marginTop: 3, color: 'rgba(255,243,215,0.8)' },
  faint: { color: 'rgba(255,243,215,0.62)' },
  time: { fontSize: 12, fontWeight: '700', color: 'rgba(255,243,215,0.8)', fontVariant: ['tabular-nums'] },
  empty: { fontSize: 14, color: colors.ink2 },
});
