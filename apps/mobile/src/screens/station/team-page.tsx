import { Pressable, StyleSheet, View } from 'react-native';

import { isShowingStale, useStation } from '@/api/queries';
import { Text } from '@/components/text';
import { GENERAL_EMAIL, TEAM_INTRO } from '@/content/station';
import { colors, fonts } from '@/theme';

import { openLink } from './open-link';
import { teamView } from './station-state';
import { BodyText, SmallNote } from './ui';

export function TeamPage() {
  const station = useStation();
  const view = teamView(station.data);

  return (
    <>
      <BodyText>{TEAM_INTRO}</BodyText>
      {station.isPending ? <SmallNote top={16}>Loading…</SmallNote> : null}
      {station.isError && !station.data ? (
        <SmallNote top={16}>Can&apos;t load the team right now. Go back and try again later.</SmallNote>
      ) : null}
      {isShowingStale(station) ? <SmallNote top={16}>Showing the last list we loaded.</SmallNote> : null}
      {view.kind === 'hidden' && station.data ? (
        <View style={styles.note}>
          <Text style={styles.noteTitle}>Team list coming soon</Text>
          <Text style={styles.noteText}>
            The station is confirming this semester&apos;s roster. Meanwhile, reach the station at {GENERAL_EMAIL}.
          </Text>
        </View>
      ) : null}
      {view.kind === 'list' ? (
        <View style={styles.list}>
          {view.members.map((m) => (
            <Pressable
              key={`${m.name}-${m.role}`}
              accessibilityRole="link"
              accessibilityLabel={`${m.name}, ${m.role}. Email.`}
              onPress={() => openLink(`mailto:${m.email}`)}
              style={({ pressed }) => [styles.person, pressed && { opacity: 0.78 }]}>
              <View style={styles.who}>
                <Text style={styles.name}>{m.name}</Text>
                <Text style={styles.role}>{m.role}</Text>
              </View>
              <Text style={styles.email}>EMAIL</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {view.kind === 'list' ? <SmallNote>Station leadership changes regularly.</SmallNote> : null}
    </>
  );
}

const styles = StyleSheet.create({
  list: { marginTop: 18, borderTopWidth: 1, borderTopColor: colors.rim },
  // The design's rows come out 77px tall (its name and role sit centered in them), taller than the 54px minimum
  // its CSS asks for, so the height is set to what it measures.
  person: {
    minHeight: 77,
    paddingVertical: 11,
    paddingHorizontal: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.rim,
  },
  who: { flex: 1, minWidth: 0 },
  name: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 17, color: colors.ink },
  role: { marginTop: 3, fontFamily: fonts.body, fontSize: 12, lineHeight: 16.2, color: colors.ink3 },
  email: { fontFamily: fonts.body, fontSize: 12, color: colors.live },
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
});
