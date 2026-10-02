import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useShows, useWeeklySchedule } from '@/api/queries';
import { colors } from '@/theme';

import { airTimes, slotsForShow } from '../schedule/schedule-state';
import { ReminderButton } from './reminder-button';

export function ShowScreen({ showId }: { showId: string }) {
  const shows = useShows();
  const weekly = useWeeklySchedule();

  const show = shows.data?.shows.find((s) => s.id === showId);
  const entries = slotsForShow(weekly.data, showId);
  const first = entries[0]?.slot;

  const loading = (shows.isPending || weekly.isPending) && !show && !first;
  if (loading) return <Text style={styles.status}>Loading…</Text>;
  if (!show && !first) {
    return (
      <Text style={styles.status}>
        {shows.isError || weekly.isError
          ? "Can't load this show right now. Go back and try again."
          : "We couldn't find this show."}
      </Text>
    );
  }

  const name = show?.name ?? first!.show;
  const hosts = show?.hostNames.length ? show.hostNames.join(', ') : first?.dj;
  const genres = show?.genres.length ? show.genres.join(' · ') : first?.genre;
  const description = show?.description ?? first?.blurb ?? null;
  const bio = show?.hostBio || first?.host.bio || null;
  const times = airTimes(entries);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      {show?.artwork ? (
        <Image source={{ uri: show.artwork.url }} accessibilityLabel={show.artwork.alt} style={styles.art} />
      ) : null}
      <Text style={styles.title} accessibilityRole="header">
        {name}
      </Text>
      {hosts ? <Text style={styles.hosts}>with {hosts}</Text> : null}
      {genres ? <Text style={styles.genres}>{genres}</Text> : null}

      <View style={styles.block}>
        <Text style={styles.heading}>On air</Text>
        {times.length ? (
          times.map((t) => (
            <Text key={t} style={styles.body}>
              {t}
            </Text>
          ))
        ) : (
          <Text style={styles.body}>Not on this week's schedule.</Text>
        )}
      </View>

      {times.length ? <ReminderButton showId={showId} showName={name} /> : null}

      <View style={styles.block}>
        <Text style={styles.heading}>About the show</Text>
        <Text style={styles.body}>{description ?? "The station hasn't added a description for this show yet."}</Text>
      </View>

      {bio ? (
        <View style={styles.block}>
          <Text style={styles.heading}>About the host</Text>
          <Text style={styles.body}>{bio}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 20, gap: 8, paddingBottom: 48 },
  status: { padding: 24, fontSize: 15, color: colors.ink2 },
  art: { width: '100%', aspectRatio: 1, borderRadius: 12, marginBottom: 12, backgroundColor: colors.surface2 },
  title: { fontSize: 32, fontWeight: '800', color: colors.ink },
  hosts: { fontSize: 17, color: colors.ink2 },
  genres: { fontSize: 14, color: colors.ink3 },
  block: { gap: 4, marginTop: 14 },
  heading: { fontSize: 13, fontWeight: '800', letterSpacing: 1, color: colors.live, textTransform: 'uppercase' },
  body: { fontSize: 16, lineHeight: 23, color: colors.ink },
});
