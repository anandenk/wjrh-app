import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Block } from '@/content/station';
import { colors } from '@/theme';

import { openLink } from './open-link';

export function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.kind) {
          case 'heading':
            return (
              <Text key={i} style={styles.heading} accessibilityRole="header">
                {b.text}
              </Text>
            );
          case 'text':
            return (
              <Text key={i} style={styles.text}>
                {b.text}
              </Text>
            );
          case 'facts':
            return (
              <View key={i} style={styles.facts}>
                {b.items.map((f) => (
                  <View key={f.big} style={styles.fact}>
                    <Text style={styles.factBig}>{f.big}</Text>
                    <Text style={styles.factSmall}>{f.small}</Text>
                  </View>
                ))}
              </View>
            );
          case 'timeline':
            return (
              <View key={i} style={styles.timeline}>
                {b.items.map((t) => (
                  <View key={t.when} style={styles.tRow}>
                    <Text style={styles.tWhen}>{t.when}</Text>
                    <Text style={styles.tWhat}>{t.what}</Text>
                  </View>
                ))}
              </View>
            );
          case 'card': {
            const body = (
              <>
                <Text style={styles.cardLabel}>{b.label}</Text>
                <Text style={[styles.cardValue, b.url && styles.cardLink]}>{b.value}</Text>
                {b.note ? <Text style={styles.note}>{b.note}</Text> : null}
              </>
            );
            return b.url ? (
              <Pressable
                key={i}
                accessibilityRole="link"
                accessibilityLabel={`${b.label}: ${b.value}`}
                onPress={() => openLink(b.url!)}
                style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
                {body}
              </Pressable>
            ) : (
              <View key={i} style={styles.card}>
                {body}
              </View>
            );
          }
          case 'link':
            return (
              <View key={i} style={styles.linkWrap}>
                <Pressable
                  accessibilityRole="link"
                  onPress={() => openLink(b.url)}
                  style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
                  <Text style={styles.buttonText}>{b.label}</Text>
                </Pressable>
                {b.note ? <Text style={styles.note}>{b.note}</Text> : null}
              </View>
            );
        }
      })}
    </>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 24, fontWeight: '800', color: colors.ink, marginTop: 8 },
  text: { fontSize: 16, lineHeight: 24, color: colors.ink },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  fact: {
    flexGrow: 1,
    flexBasis: '45%',
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.rim,
  },
  factBig: { fontSize: 22, fontWeight: '800', color: colors.live },
  factSmall: { fontSize: 11, fontWeight: '700', letterSpacing: 1, color: colors.ink2, marginTop: 2 },
  timeline: { gap: 12 },
  tRow: { gap: 2 },
  tWhen: { fontSize: 13, fontWeight: '800', letterSpacing: 0.5, color: colors.live },
  tWhat: { fontSize: 16, lineHeight: 22, color: colors.ink },
  card: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.rim,
    gap: 3,
  },
  cardLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: colors.live },
  cardValue: { fontSize: 17, fontWeight: '600', color: colors.ink },
  cardLink: { textDecorationLine: 'underline' },
  note: { fontSize: 13, lineHeight: 19, color: colors.ink2 },
  linkWrap: { gap: 6 },
  button: {
    alignSelf: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: colors.live,
  },
  buttonText: { fontSize: 16, fontWeight: '700', color: colors.onImage },
  pressed: { opacity: 0.8 },
});
