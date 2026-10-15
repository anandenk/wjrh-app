import type { Station } from '@/api/types';

// Pure helpers for the Station tab.

export type TeamView =
  | { kind: 'hidden' } // the station has not confirmed the roster for this semester
  | { kind: 'list'; members: Station['team'] };

/**
 * `approved` stays false until the station confirms the roster each semester (docs/backend-proposal/api.md).
 * The roster has students' names and email addresses, so until then it is not shown at all.
 */
export function teamView(station: Pick<Station, 'approved' | 'team'> | undefined): TeamView {
  if (!station || !station.approved) return { kind: 'hidden' };
  return { kind: 'list', members: station.team };
}

/** Upcoming events soonest first; past events most recent first. `today` is YYYY-MM-DD (station time). */
export function splitEvents(events: Station['events'], today: string) {
  const upcoming = events.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past = events.filter((e) => e.date < today).sort((a, b) => b.date.localeCompare(a.date));
  return { upcoming, past };
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** "2025-10-16" -> "October 16, 2025" (the design spells the month out). Returns the input unchanged if it isn't a YYYY-MM-DD date. */
export function formatEventDate(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return ymd;
  const month = MONTHS[Number(m[2]) - 1];
  return month ? `${month} ${Number(m[3])}, ${m[1]}` : ymd;
}
