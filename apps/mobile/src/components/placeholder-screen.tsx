import { StyleSheet, Text, View } from 'react-native';

// Stand-in until each screen is built (see the build order in docs/mobile-app/plan.md).
export function PlaceholderScreen({ title, note }: { title: string; note: string }) {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.note}>{note}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  title: { fontSize: 28, fontWeight: '700' },
  note: { fontSize: 15, opacity: 0.6, textAlign: 'center' },
});
