import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import type { Block } from '@/content/station';
import { colors, fonts } from '@/theme';

import { openLink } from './open-link';
import { BodyText, CtaButton, FactGrid, InfoList, RowLink, SectionLabel, SmallNote, stationText } from './ui';

/** Draws a static page's blocks in the design's styles. */
export function Blocks({ blocks }: { blocks: Block[] }) {
  const router = useRouter();
  return (
    <>
      {blocks.map((b, i) => {
        switch (b.kind) {
          case 'text':
            return (
              <BodyText key={i} flush={b.flush}>
                {b.text}
              </BodyText>
            );
          case 'label':
            return <SectionLabel key={i}>{b.text}</SectionLabel>;
          case 'facts':
            return <FactGrid key={i} items={b.items} />;
          case 'timeline':
            return <InfoList key={i} items={b.items.map((t) => ({ title: t.when, meta: t.what }))} />;
          case 'note':
            return (
              <View key={i} style={styles.note}>
                <Text style={styles.noteTitle}>{b.title}</Text>
                <Text style={styles.noteText}>{b.text}</Text>
              </View>
            );
          case 'buttons':
            return (
              <View key={i} style={styles.buttons}>
                {b.items.map((cta) => (
                  <CtaButton key={cta.label} cta={cta} />
                ))}
              </View>
            );
          case 'button':
            return (
              <View key={i}>
                <CtaButton cta={b.cta} top={b.gapAbove} />
                {b.after ? <SmallNote top={10}>{b.after}</SmallNote> : null}
              </View>
            );
          case 'rows':
            return (
              <View key={i}>
                {b.items.map((r) => (
                  <RowLink key={r.page} label={r.label} onPress={() => router.push(`/station/${r.page}`)} />
                ))}
              </View>
            );
          case 'card': {
            const first = blocks[i - 1]?.kind !== 'card';
            const body = (
              <>
                <Text style={styles.cardLabel}>{b.label}</Text>
                <Text style={styles.cardValue}>{b.value}</Text>
                {b.note ? <Text style={stationText.meta}>{b.note}</Text> : null}
                {b.cta ? <CtaButton cta={b.cta} top={12} /> : null}
              </>
            );
            return b.url ? (
              <Pressable
                key={i}
                accessibilityRole="link"
                accessibilityLabel={`${b.label}: ${b.value}`}
                onPress={() => openLink(b.url!)}
                style={({ pressed }) => [styles.card, first && styles.cardFirst, pressed && { opacity: 0.78 }]}>
                {body}
              </Pressable>
            ) : (
              <View key={i} style={[styles.card, first && styles.cardFirst]}>
                {body}
              </View>
            );
          }
        }
      })}
    </>
  );
}

const styles = StyleSheet.create({
  note: {
    marginTop: 18,
    paddingVertical: 14,
    paddingHorizontal: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.rim,
    backgroundColor: colors.surface,
  },
  noteTitle: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 15, color: colors.ink },
  noteText: { marginTop: 3, fontFamily: fonts.body, fontSize: 12, lineHeight: 17.4, color: colors.ink2 },
  buttons: { marginTop: 18, flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  card: { paddingVertical: 15, paddingHorizontal: 2, borderTopWidth: 1, borderTopColor: colors.rim },
  cardFirst: { marginTop: 18 },
  cardLabel: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 15, letterSpacing: 0.48, color: colors.ink3 },
  cardValue: { marginTop: 7, fontFamily: fonts.body, fontSize: 15, lineHeight: 21.75, color: colors.ink },
});
