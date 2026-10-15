import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { useArchiveCatalog } from '@/archive/use-archive';
import { ChevronRight } from '@/components/icons';
import { DisplayText, Text } from '@/components/text';
import { colors, fonts } from '@/theme';

import { BroadcastRow } from './broadcast-row';

/** DEMO ONLY: "Past broadcasts" with sample recordings, on a show's page and on its Archive page. */
export function PastBroadcasts({ showId, linkToArchive = false }: { showId: string; linkToArchive?: boolean }) {
  const router = useRouter();
  const catalog = useArchiveCatalog();
  const show = catalog.shows.find((s) => s.showId === showId);
  if (!show) return null;

  return (
    <View style={styles.section}>
      <DisplayText style={styles.heading} accessibilityRole="header">
        Past broadcasts
      </DisplayText>
      <Text style={styles.note}>Sample dates and recordings · proof of concept</Text>
      <View style={styles.list}>
        {show.episodes.map((episode) => (
          <BroadcastRow key={episode.id} episode={episode} />
        ))}
      </View>
      {linkToArchive ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`Open the ${show.name} archive`}
          onPress={() => router.push(`/archive/${show.showId}`)}
          style={({ pressed }) => [styles.link, pressed && { opacity: 0.78 }]}>
          <Text style={styles.linkText}>Open the archive</Text>
          <ChevronRight size={16} color={colors.accentInk} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: 22, paddingBottom: 4 },
  heading: {
    paddingHorizontal: 20,
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 28,
    letterSpacing: 0.28,
    textTransform: 'uppercase',
    color: colors.accentInk,
  },
  note: {
    marginTop: 7,
    marginBottom: 14,
    marginHorizontal: 20,
    fontFamily: fonts.bold,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.logoGold,
  },
  list: { borderTopWidth: 1, borderTopColor: colors.onImageFaint },
  link: {
    minHeight: 52,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.onImageFaint,
  },
  linkText: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 19, color: colors.accentInk },
});
