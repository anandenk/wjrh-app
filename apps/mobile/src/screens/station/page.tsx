import { StyleSheet } from 'react-native';

import { Text } from '@/components/text';
import { API_PAGES, findStaticPage } from '@/content/station';
import { colors, fonts } from '@/theme';

import { Blocks } from './blocks';
import { EventsPage } from './events-page';
import { TeamPage } from './team-page';
import { PageHero, PageTitle, StationFrame } from './ui';

/** One page of the Station tab: static copy, or the API-backed team / events pages. */
export function StationPageScreen({ page }: { page: string }) {
  const staticPage = findStaticPage(page);
  const def = staticPage ?? API_PAGES[page];

  if (!def) {
    return (
      <StationFrame back>
        <Text style={styles.note}>We couldn&apos;t find that page.</Text>
      </StationFrame>
    );
  }

  return (
    <StationFrame back>
      <PageTitle kicker={def.kicker} title={def.title} />
      <PageHero hero={def.hero} />
      {page === 'team' ? <TeamPage /> : page === 'events' ? <EventsPage /> : staticPage ? <Blocks blocks={staticPage.blocks} /> : null}
    </StationFrame>
  );
}

const styles = StyleSheet.create({
  note: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.ink2 },
});
