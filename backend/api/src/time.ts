// Wall-clock time in America/New_York without a timezone library.
// Everything the station schedules is expressed in ET wall time; instants are
// epoch milliseconds. Intl supplies the offset for any instant, including DST.

export const ET = 'America/New_York';

export interface Wall {
  y: number;
  mo: number; // 1-12
  d: number;
  h: number;
  mi: number;
  s: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(tz, f);
  }
  return f;
}

export function toWall(ms: number, tz = ET): Wall {
  const parts: Record<string, number> = {};
  for (const p of formatter(tz).formatToParts(new Date(ms))) {
    if (p.type !== 'literal') parts[p.type] = Number(p.value);
  }
  return { y: parts.year, mo: parts.month, d: parts.day, h: parts.hour % 24, mi: parts.minute, s: parts.second };
}

/** Offset of `tz` from UTC at instant `ms`, in minutes (ET summer = -240). */
export function offsetMinutes(ms: number, tz = ET): number {
  const w = toWall(ms, tz);
  const asUtc = Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s);
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60000);
}

/** Instant for a wall-clock time in `tz`. Nonexistent DST-gap times shift forward. */
export function fromWall(w: Wall, tz = ET): number {
  const guess = Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s);
  const first = guess - offsetMinutes(guess, tz) * 60000;
  const second = guess - offsetMinutes(first, tz) * 60000;
  return second;
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

/** ISO 8601 with the ET offset, e.g. 2026-09-30T17:00:00-04:00. */
export function isoET(ms: number): string {
  const w = toWall(ms);
  const off = offsetMinutes(ms);
  const sign = off < 0 ? '-' : '+';
  const abs = Math.abs(off);
  return `${w.y}-${pad(w.mo)}-${pad(w.d)}T${pad(w.h)}:${pad(w.mi)}:${pad(w.s)}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

export function isoOrNull(ms: number | null | undefined): string | null {
  return ms == null ? null : isoET(ms);
}

// ---- calendar-date arithmetic (dates carry no time zone) ----

export interface CivilDate {
  y: number;
  mo: number;
  d: number;
}

export function addDays(date: CivilDate, days: number): CivilDate {
  const t = new Date(Date.UTC(date.y, date.mo - 1, date.d + days));
  return { y: t.getUTCFullYear(), mo: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

/** Monday = 0 … Sunday = 6, matching the app's DAY_KEYS. */
export function weekday(date: CivilDate): number {
  return (new Date(Date.UTC(date.y, date.mo - 1, date.d)).getUTCDay() + 6) % 7;
}

export function compareDates(a: CivilDate, b: CivilDate): number {
  return a.y - b.y || a.mo - b.mo || a.d - b.d;
}

export function dateKey(date: CivilDate): string {
  return `${date.y}-${pad(date.mo)}-${pad(date.d)}`;
}

export function parseDateParam(value: string | undefined | null): CivilDate | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const date = { y: Number(m[1]), mo: Number(m[2]), d: Number(m[3]) };
  const check = addDays(date, 0);
  return compareDates(check, date) === 0 ? date : null;
}

export function etDate(ms: number): CivilDate {
  const w = toWall(ms);
  return { y: w.y, mo: w.mo, d: w.d };
}

/** Start of an ET calendar day as an instant. */
export function startOfEtDay(date: CivilDate): number {
  return fromWall({ ...date, h: 0, mi: 0, s: 0 });
}

export const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
