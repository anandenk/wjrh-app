import { Stack } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { findStaticPage, HUB_ORDER } from '@/content/station';
import { colors } from '@/theme';

import { Blocks } from './blocks';
import { EventsPage } from './events-page';
import { TeamPage } from './team-page';

/** One page of the Station tab: static copy, or the API-backed team / events pages. */
export function StationPageScreen({ page }: { page: string }) {
  const entry = HUB_ORDER.find((p) => p.slug === page);
  const staticPage = findStaticPage(page);

  let body;
  if (page === 'team') body = <TeamPage />;
  else if (page === 'events') body = <EventsPage />;
  else if (staticPage) body = <Blocks blocks={staticPage.blocks} />;
  else body = <Text style={styles.note}>We couldn't find that page.</Text>;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <Stack.Screen options={{ title: entry?.title ?? '' }} />
      {body}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, gap: 14, paddingBottom: 48 },
  note: { fontSize: 15, color: colors.ink2 },
});
