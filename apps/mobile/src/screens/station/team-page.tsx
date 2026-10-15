import { Pressable, StyleSheet, Text, View } from 'react-native';

import { isShowingStale, useStation } from '@/api/queries';
import { TEAM_INTRO, GENERAL_EMAIL } from '@/content/station';
import { colors } from '@/theme';

import { openLink } from './open-link';
import { teamView } from './station-state';

export function TeamPage() {
  const station = useStation();
  const view = teamView(station.data);

  return (
    <>
      <Text style={styles.text}>{TEAM_INTRO}</Text>
      {station.isPending ? <Text style={styles.note}>Loading…</Text> : null}
      {station.isError && !station.data ? (
        <Text style={styles.note}>Can&apos;t load the team right now. Pull back and try again later.</Text>
      ) : null}
      {isShowingStale(station) ? <Text style={styles.note}>Showing the last list we loaded.</Text> : null}
      {view.kind === 'hidden' && station.data ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Team list coming soon</Text>
          <Text style={styles.note}>
            The station is confirming this semester&apos;s roster. Meanwhile, reach the station at {GENERAL_EMAIL}.
          </Text>
        </View>
      ) : null}
      {view.kind === 'list'
        ? view.members.map((m) => (
            <Pressable
              key={`${m.name}-${m.role}`}
              accessibilityRole="link"
              accessibilityLabel={`${m.name}, ${m.role}. Email.`}
              onPress={() => openLink(`mailto:${m.email}`)}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
              <Text style={styles.cardTitle}>{m.name}</Text>
              <Text style={styles.role}>{m.role}</Text>
              <Text style={styles.email}>{m.email}</Text>
            </Pressable>
          ))
        : null}
    </>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 16, lineHeight: 24, color: colors.ink },
  note: { fontSize: 14, lineHeight: 20, color: colors.ink2 },
  card: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.rim,
    gap: 3,
  },
  pressed: { opacity: 0.8 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: colors.ink },
  role: { fontSize: 14, color: colors.ink2 },
  email: { fontSize: 14, color: colors.live, textDecorationLine: 'underline' },
});
