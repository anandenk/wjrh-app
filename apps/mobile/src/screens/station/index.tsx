import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { HUB_ORDER, STATION_INTRO } from '@/content/station';
import { colors } from '@/theme';

export function StationScreen() {
  const router = useRouter();
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <Text style={styles.intro}>{STATION_INTRO}</Text>
      <View style={styles.list}>
        {HUB_ORDER.map((p) => (
          <Pressable
            key={p.slug}
            accessibilityRole="button"
            accessibilityLabel={`${p.title}. ${p.subtitle}`}
            onPress={() => router.push(`/station/${p.slug}`)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>{p.title}</Text>
              <Text style={styles.rowSub}>{p.subtitle}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, gap: 18, paddingBottom: 48 },
  intro: { fontSize: 17, lineHeight: 25, color: colors.ink },
  list: { gap: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.rim,
  },
  pressed: { opacity: 0.8 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 18, fontWeight: '700', color: colors.ink },
  rowSub: { fontSize: 14, color: colors.ink3 },
  chevron: { fontSize: 24, color: colors.ink3, marginLeft: 8 },
});
