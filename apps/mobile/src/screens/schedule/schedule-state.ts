import type { ScheduleWeekly } from '@/api/types';

// Pure schedule helpers. The station's clock is Eastern time, so "today", "on air now" and every
// displayed time use that, wherever the phone is.

export const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type DayKey = (typeof DAY_KEYS)[number];

export const DAY_SHORT: Record<DayKey, string> = {
  mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun',
};
export const DAY_LONG: Record<DayKey, string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
};

export type Slot = ScheduleWeekly['days'][string][number];

const STATION_TZ = 'America/New_York';

/** Which day of the week it is at the station, and minutes since midnight there. */
export function stationClock(now: Date): { day: DayKey; minute: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: STATION_TZ,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return {
    day: get('weekday').slice(0, 3).toLowerCase() as DayKey,
    minute: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

/** YYYY-MM-DD in station time, `offsetDays` from `now`. */
export function stationDate(now: Date, offsetDays = 0): string {
  const shifted = new Date(now.getTime() + offsetDays * 86_400_000);
  // "en-CA" formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: STATION_TZ }).format(shifted);
}

/** Is this slot on air right now? `day` is the day the slot belongs to. */
export function isOnAir(slot: Pick<Slot, 'startMin' | 'endMin'>, day: DayKey, now: Date): boolean {
  const clock = stationClock(now);
  // A show that runs to midnight is stored with an end at or before its start.
  const end = slot.endMin > slot.startMin ? slot.endMin : 1440;
  return clock.day === day && clock.minute >= slot.startMin && clock.minute < end;
}

/** "13:00" -> "1:00 PM". */
export function formatHm(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const period = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${period}`;
}

/** "1:00 – 2:00 PM", or "11:00 AM – 1:00 PM" when the period changes. */
export function formatRange(startsAt: string, endsAt: string): string {
  const a = formatHm(startsAt);
  const b = formatHm(endsAt);
  return a.slice(-2) === b.slice(-2) ? `${a.slice(0, -3)} – ${b}` : `${a} – ${b}`;
}

/** The slots for one day, in air order. */
export function slotsForDay(weekly: ScheduleWeekly | undefined, day: DayKey): Slot[] {
  return [...(weekly?.days[day] ?? [])].sort((x, y) => x.startMin - y.startMin);
}

/** Every weekly slot of one show, with its day: "when does this show air?". */
export function slotsForShow(
  weekly: ScheduleWeekly | undefined,
  showId: string,
): { day: DayKey; slot: Slot }[] {
  if (!weekly) return [];
  return DAY_KEYS.flatMap((day) =>
    (weekly.days[day] ?? []).filter((s) => s.showId === showId).map((slot) => ({ day, slot })),
  );
}

/** "Mondays 12:00 – 1:00 PM" lines for a show page. */
export function airTimes(entries: { day: DayKey; slot: Slot }[]): string[] {
  return entries.map(({ day, slot }) => `${DAY_LONG[day]}s ${formatRange(slot.startsAt, slot.endsAt)}`);
}

/** "17:00–18:00": the design prints schedule times on a 24-hour clock, in station time. */
export function formatRange24(startsAt: string, endsAt: string): string {
  return `${startsAt}\u2013${endsAt}`;
}

export type ScheduleRow =
  | { kind: 'day'; day: DayKey; label: string }
  | { kind: 'show'; day: DayKey; slot: Slot };

/** The whole week as one stream: a day marker, then that day's shows in air order. Days with no shows are left out. */
export function scheduleRows(weekly: ScheduleWeekly | undefined): ScheduleRow[] {
  return DAY_KEYS.flatMap((day) => {
    const slots = slotsForDay(weekly, day);
    if (slots.length === 0) return [];
    return [
      { kind: 'day' as const, day, label: DAY_LONG[day] },
      ...slots.map((slot) => ({ kind: 'show' as const, day, slot })),
    ];
  });
}

/** "Mon D" for an ISO timestamp, in station time ("Oct 2"). Empty string if unparseable. */
export function formatMonthDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: STATION_TZ });
}

/** The line under the list: where the schedule comes from and how fresh it is. */
export function freshnessLine(generatedAt: string | undefined): string {
  const when = generatedAt ? formatMonthDay(generatedAt) : '';
  return when ? `Schedule synced from WJRH Google Calendar \u00b7 ${when}` : 'Schedule from the WJRH Google Calendar';
}
