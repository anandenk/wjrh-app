import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useStation } from '@/api/queries';
import { EVENT_ARCHIVE_URL, EVENTS_INTRO } from '@/content/station';
import { stationDate } from '@/screens/schedule/schedule-state';
import { colors } from '@/theme';

import { openLink } from './open-link';
import { formatEventDate, splitEvents } from './station-state';

export function EventsPage() {
  const station = useStation();
  const { upcoming, past } = splitEvents(station.data?.events ?? [], stationDate(new Date()));

  const list = (events: typeof upcoming) =>
    events.map((e) => (
      <View key={`${e.date}-${e.name}`} style={styles.row}>
        <Text style={styles.name}>{e.name}</Text>
        <Text style={styles.date}>{formatEventDate(e.date)}</Text>
      </View>
    ));

  return (
    <>
      <Text style={styles.text}>{EVENTS_INTRO}</Text>
      {station.isPending ? <Text style={styles.note}>Loading…</Text> : null}
      {station.isError && !station.data ? <Text style={styles.note}>Can&apos;t load events right now.</Text> : null}
      {station.data ? (
        <>
          <Text style={styles.heading} accessibilityRole="header">
            Upcoming
          </Text>
          {upcoming.length ? list(upcoming) : <Text style={styles.note}>No upcoming events are listed right now.</Text>}
          {past.length ? (
            <>
              <Text style={styles.heading} accessibilityRole="header">
                Event archive
              </Text>
              {list(past)}
            </>
          ) : null}
        </>
      ) : null}
      <Pressable
        accessibilityRole="link"
        onPress={() => openLink(EVENT_ARCHIVE_URL)}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
        <Text style={styles.buttonText}>View event archive</Text>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 16, lineHeight: 24, color: colors.ink },
  note: { fontSize: 14, lineHeight: 20, color: colors.ink2 },
  heading: { fontSize: 22, fontWeight: '800', color: colors.ink, marginTop: 8 },
  row: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.rim,
    gap: 2,
  },
  name: { fontSize: 16, fontWeight: '700', color: colors.ink },
  date: { fontSize: 13, color: colors.ink2 },
  button: {
    alignSelf: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.live,
  },
  buttonText: { fontSize: 16, fontWeight: '700', color: colors.live },
  pressed: { opacity: 0.8 },
});
