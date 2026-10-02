import type { Schedule } from '@/api/types';

// Decides which local notifications to schedule. Pure, so it is unit-tested; the expo-notifications
// calls live in notifications.ts.

export const REMINDER_PREFIX = 'reminder:';
/** iOS keeps at most 64 pending local notifications per app; stay under it. */
export const MAX_REMINDERS = 60;
export const HORIZON_DAYS = 28;

export type PlannedReminder = {
  id: string;
  showId: string;
  title: string;
  body: string;
  at: Date;
};

export function planReminders(opts: {
  occurrences: Schedule['occurrences'];
  showIds: ReadonlySet<string>;
  now: Date;
  maxCount?: number;
  horizonDays?: number;
}): PlannedReminder[] {
  const { occurrences, showIds, now } = opts;
  const limit = now.getTime() + (opts.horizonDays ?? HORIZON_DAYS) * 86_400_000;
  return occurrences
    .filter((o) => showIds.has(o.showId) && !o.cancelled)
    .map((o) => ({ o, at: new Date(o.startsAt) }))
    .filter(({ at }) => at.getTime() > now.getTime() && at.getTime() <= limit)
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, opts.maxCount ?? MAX_REMINDERS)
    .map(({ o, at }) => ({
      id: `${REMINDER_PREFIX}${o.id}`,
      showId: o.showId,
      title: `${o.title} is starting`,
      body: o.hostNames.length ? `with ${o.hostNames.join(', ')} · WJRH 104.9 FM` : 'WJRH 104.9 FM',
      at,
    }));
}
