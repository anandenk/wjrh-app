import * as Notifications from 'expo-notifications';

import { getSchedule } from '@/api/endpoints';
import { stationDate } from '@/screens/schedule/schedule-state';

import { HORIZON_DAYS, planReminders, REMINDER_PREFIX } from './plan';

// "Remind me when this show starts": local notifications scheduled from /v1/schedule occurrences,
// so they follow the real schedule (cancelled episodes are skipped; times stay in station time).
// The scheduled notifications themselves are the record of which shows have a reminder, so there is
// no separate storage. Local notifications run out after HORIZON_DAYS if the app is never opened,
// because they are re-planned each time it opens.

export type ReminderResult = 'ok' | 'denied' | 'error';

export function configureNotificationHandler(): void {
  // Show the banner even when the app is open (the listener may be on another tab).
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

async function scheduledReminders() {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  return all.filter((n) => n.identifier.startsWith(REMINDER_PREFIX));
}

/** Show ids that currently have a reminder. */
export async function getReminderShowIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  for (const n of await scheduledReminders()) {
    const showId = (n.content.data as { showId?: unknown } | null)?.showId;
    if (typeof showId === 'string') ids.add(showId);
  }
  return ids;
}

/** Re-plan reminders for `showIds` from the latest schedule. Throws if the schedule can't be fetched. */
export async function syncReminders(showIds: ReadonlySet<string>): Promise<void> {
  const now = new Date();
  // Fetch first: if offline, keep the reminders we already have rather than cancelling them.
  const schedule = showIds.size
    ? await getSchedule(stationDate(now), stationDate(now, HORIZON_DAYS))
    : null;

  for (const n of await scheduledReminders()) {
    await Notifications.cancelScheduledNotificationAsync(n.identifier);
  }
  if (!schedule) return;

  for (const r of planReminders({ occurrences: schedule.occurrences, showIds, now })) {
    await Notifications.scheduleNotificationAsync({
      identifier: r.id,
      content: { title: r.title, body: r.body, data: { showId: r.showId } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.at },
    });
  }
}

async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/** Turn the reminder for one show on or off. */
export async function setReminder(showId: string, enabled: boolean): Promise<ReminderResult> {
  try {
    if (enabled && !(await ensurePermission())) return 'denied';
    const ids = await getReminderShowIds();
    if (enabled) ids.add(showId);
    else ids.delete(showId);
    await syncReminders(ids);
    return 'ok';
  } catch {
    return 'error';
  }
}
