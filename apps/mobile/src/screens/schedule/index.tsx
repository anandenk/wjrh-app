import { useRouter } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { isShowingStale, useWeeklySchedule } from '@/api/queries';
import { useNow } from '@/hooks/use-now';
import { colors } from '@/theme';
import { formatStationTime } from '@/utils/format-time';

import { DayPicker } from './day-picker';
import { DAY_LONG, isOnAir, slotsForDay, stationClock, type DayKey } from './schedule-state';
import { SlotRow } from './slot-row';

export function ScheduleScreen() {
  const router = useRouter();
  const now = useNow();
  const today = stationClock(now).day;
  const [picked, setPicked] = useState<DayKey | null>(null);
  const day = picked ?? today;

  const weekly = useWeeklySchedule();
  const slots = slotsForDay(weekly.data, day);

  const notice = weekly.isError && !weekly.data
    ? "Can't load the schedule right now. Pull down to try again."
    : isShowingStale(weekly)
      ? `Showing the last schedule we loaded (${formatStationTime(new Date(weekly.dataUpdatedAt).toISOString())}).`
      : null;

  return (
    <ScrollView
      style={styles.root}
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={<RefreshControl refreshing={weekly.isRefetching} onRefresh={() => void weekly.refetch()} />}>
      <DayPicker selected={day} today={today} onSelect={setPicked} />
      {notice ? (
        <View style={styles.notice} accessibilityRole="alert">
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      ) : null}
      <View style={styles.list}>
        <Text style={styles.dayTitle} accessibilityRole="header">
          {DAY_LONG[day]}
        </Text>
        {weekly.isPending ? (
          <Text style={styles.empty}>Loading…</Text>
        ) : slots.length === 0 ? (
          <Text style={styles.empty}>
            {weekly.data ? 'No shows scheduled. WJRH plays automated programming.' : ''}
          </Text>
        ) : (
          slots.map((slot) => (
            <SlotRow
              key={slot.id}
              slot={slot}
              onAir={isOnAir(slot, day, now)}
              onPress={() => router.push(`/schedule/${slot.showId}`)}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  notice: { backgroundColor: colors.surface2, paddingVertical: 10, paddingHorizontal: 20 },
  noticeText: { fontSize: 13, fontWeight: '600', color: colors.ink },
  list: { padding: 16, gap: 10 },
  dayTitle: { fontSize: 22, fontWeight: '800', color: colors.ink, marginBottom: 2 },
  empty: { fontSize: 14, color: colors.ink2 },
});
