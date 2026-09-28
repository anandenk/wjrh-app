import { describe, expect, it } from 'vitest';
import { expand, IcsError, initials, parseCalendar, shorten, splitSummary, stripHtml } from '../src/ics';
import { cleanMeta, normalizePayload } from '../src/nowplaying';
import { isoET } from '../src/time';

function cal(...events: string[][]): string {
  const body = events.map((lines) => ['BEGIN:VEVENT', ...lines, 'END:VEVENT'].join('\r\n')).join('\r\n');
  return `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${body}\r\nEND:VCALENDAR\r\n`;
}

const weekly = (extra: string[] = [], summary = 'Supercut - Reese') => [
  'DTSTART;TZID=America/New_York:20260904T160000',
  'DTEND;TZID=America/New_York:20260904T170000',
  'RRULE:FREQ=WEEKLY;BYDAY=FR',
  'UID:supercut@test',
  `SUMMARY:${summary}`,
  ...extra,
];

const range = (a: string, b: string) => [Date.parse(a), Date.parse(b)] as const;
const starts = (text: string, from: string, to: string) => {
  const { events } = parseCalendar(text);
  return expand(events, ...range(from, to)).occurrences.map((o) => `${isoET(o.startMs)}${o.cancelled ? ' cancelled' : ''}`);
};

describe('summary and text helpers (parity with fetch_schedule.py)', () => {
  it('splits on the last dash of any kind', () => {
    expect(splitSummary('J-J-Jams - Janella and Josie')).toEqual({ show: 'J-J-Jams', dj: 'Janella and Josie' });
    expect(splitSummary('The Bit–Tom')).toEqual({ show: 'The Bit', dj: 'Tom' });
    expect(splitSummary('Station ID')).toEqual({ show: 'Station ID', dj: '' });
  });

  it('builds host initials like the Python generator', () => {
    expect(initials('Josie and Rosetta')).toBe('JR');
    expect(initials('Sofie Nordstrom')).toBe('SN');
    expect(initials('Téo')).toBe('T');
    expect(initials('')).toBe('?');
  });

  it('shortens genre lists on a word boundary', () => {
    expect(shorten('Eclectic, alternative, metal, jazz, soul, R and B, electronic, etc.')).toBe(
      'Eclectic, alternative, metal, jazz, soul, R and B…',
    );
    expect(shorten('Folk and anti-folk')).toBe('Folk and anti-folk');
  });

  it('strips Google Calendar HTML descriptions', () => {
    expect(stripHtml('<p>Rock<br>pop &amp; punk</p><p>more</p>')).toBe('Rock\npop & punk\nmore');
  });
});

describe('recurrence expansion', () => {
  it('expands weekly rules into dated occurrences', () => {
    expect(starts(cal(weekly()), '2026-09-01T00:00:00Z', '2026-09-20T00:00:00Z')).toEqual([
      '2026-09-04T16:00:00-04:00',
      '2026-09-11T16:00:00-04:00',
      '2026-09-18T16:00:00-04:00',
    ]);
  });

  it('keeps ET wall time across the end of daylight saving', () => {
    expect(starts(cal(weekly()), '2026-10-25T00:00:00Z', '2026-11-10T00:00:00Z')).toEqual([
      '2026-10-30T16:00:00-04:00',
      '2026-11-06T16:00:00-05:00',
    ]);
  });

  it('honours EXDATE, UNTIL, COUNT and INTERVAL', () => {
    const ex = cal(weekly(['EXDATE;TZID=America/New_York:20260911T160000']));
    expect(starts(ex, '2026-09-01T00:00:00Z', '2026-09-20T00:00:00Z')).toEqual([
      '2026-09-04T16:00:00-04:00',
      '2026-09-18T16:00:00-04:00',
    ]);
    const until = cal(weekly().map((l) => (l.startsWith('RRULE') ? 'RRULE:FREQ=WEEKLY;BYDAY=FR;UNTIL=20260912T035959Z' : l)));
    expect(starts(until, '2026-09-01T00:00:00Z', '2026-10-01T00:00:00Z')).toHaveLength(2);
    const count = cal(weekly().map((l) => (l.startsWith('RRULE') ? 'RRULE:FREQ=WEEKLY;BYDAY=FR;COUNT=3' : l)));
    expect(starts(count, '2026-09-01T00:00:00Z', '2026-12-01T00:00:00Z')).toHaveLength(3);
    const biweekly = cal(weekly().map((l) => (l.startsWith('RRULE') ? 'RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=FR' : l)));
    expect(starts(biweekly, '2026-09-01T00:00:00Z', '2026-09-30T00:00:00Z')).toEqual([
      '2026-09-04T16:00:00-04:00',
      '2026-09-18T16:00:00-04:00',
    ]);
  });

  it('applies RECURRENCE-ID overrides: cancelled and moved instances', () => {
    const text = cal(
      weekly(),
      [
        'DTSTART;TZID=America/New_York:20260911T160000',
        'DTEND;TZID=America/New_York:20260911T170000',
        'RECURRENCE-ID;TZID=America/New_York:20260911T160000',
        'UID:supercut@test',
        'STATUS:CANCELLED',
        'SUMMARY:Supercut - Reese',
      ],
      [
        'DTSTART;TZID=America/New_York:20260918T180000',
        'DTEND;TZID=America/New_York:20260918T190000',
        'RECURRENCE-ID;TZID=America/New_York:20260918T160000',
        'UID:supercut@test',
        'SUMMARY:Supercut (late) - Reese',
      ],
    );
    expect(starts(text, '2026-09-01T00:00:00Z', '2026-09-20T00:00:00Z')).toEqual([
      '2026-09-04T16:00:00-04:00',
      '2026-09-11T16:00:00-04:00 cancelled',
      '2026-09-18T18:00:00-04:00',
    ]);
  });

  it('drops a cancelled series and skips all-day notices with a warning', () => {
    const text = cal(weekly(['STATUS:CANCELLED']), [
      'DTSTART;VALUE=DATE:20260915',
      'UID:break@test',
      'SUMMARY:Fall break',
    ]);
    const parsed = parseCalendar(text);
    expect(parsed.warnings).toEqual(['skipped all-day event "Fall break"']);
    expect(expand(parsed.events, ...range('2026-09-01T00:00:00Z', '2026-10-01T00:00:00Z')).occurrences).toEqual([]);
  });

  it('removes duplicate one-offs shadowing a recurrence', () => {
    const dup = ['DTSTART;TZID=America/New_York:20260911T160000', 'DTEND;TZID=America/New_York:20260911T170000', 'UID:dup@test', 'SUMMARY:Supercut - Reese'];
    expect(starts(cal(weekly(), dup), '2026-09-10T00:00:00Z', '2026-09-12T00:00:00Z')).toEqual(['2026-09-11T16:00:00-04:00']);
  });

  it('rejects documents that are not a complete calendar', () => {
    expect(() => parseCalendar('<html>oops</html>')).toThrow(IcsError);
    expect(() => parseCalendar('BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:x')).toThrow(IcsError);
  });
});

describe('now-playing normalization (port of app.js cleanMeta)', () => {
  it('treats Null, null, unknown, dash and blanks as missing', () => {
    for (const v of [null, undefined, 'Null', 'NULL', 'null', 'unknown', '-', '   ', '']) expect(cleanMeta(v)).toBeNull();
  });

  it('URL-decodes values, including + for spaces and non-ASCII', () => {
    expect(cleanMeta('Caf%C3%A9+%26+Cr%C3%A8me')).toBe('Café & Crème');
    expect(cleanMeta('100%')).toBe('100%'); // malformed escapes are left alone
  });

  it('returns a null track when title and artist are both missing', () => {
    expect(normalizePayload({ nowplaying: { ARTIST: 'Null', TITLE: 'Null' } })).toBeNull();
    expect(normalizePayload('garbage')).toBeNull();
    expect(normalizePayload({ nowplaying: { ARTIST: '', TITLE: 'Gasket Weather' } })).toEqual({
      title: 'Gasket Weather',
      artist: null,
      album: null,
      artworkUrl: null,
    });
  });
});
