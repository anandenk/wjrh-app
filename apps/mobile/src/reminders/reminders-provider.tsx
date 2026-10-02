import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { DEV_ROUTE } from '@/config';

import { configureNotificationHandler, getReminderShowIds, syncReminders } from './notifications';

configureNotificationHandler();

/** Keeps reminders in step with the schedule and opens the show when a reminder is tapped. */
export function RemindersProvider({ children }: { children: ReactNode }) {
  const router = useRouter();

  // Re-plan on launch and whenever the app comes to the foreground (the schedule may have changed).
  useEffect(() => {
    const resync = () => {
      getReminderShowIds()
        .then((ids) => (ids.size ? syncReminders(ids) : undefined))
        .catch(() => {}); // offline: keep what is already scheduled
    };
    resync();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && resync());
    return () => sub.remove();
  }, []);

  // Dev-only: jump to a route (see config.ts).
  useEffect(() => {
    if (!DEV_ROUTE) return;
    // A comma-separated list steps through the routes, 8 s apart, so one launch can show several screens.
    const timers = DEV_ROUTE.split(',').map((route, i) =>
      setTimeout(() => router.navigate(route as never), 3000 + i * 8000),
    );
    return () => timers.forEach(clearTimeout);
  }, [router]);

  // Tapping a reminder opens that show's page.
  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    const showId = (response?.notification.request.content.data as { showId?: unknown } | undefined)?.showId;
    if (typeof showId === 'string') router.push(`/schedule/${showId}`);
  }, [response, router]);

  return <>{children}</>;
}
