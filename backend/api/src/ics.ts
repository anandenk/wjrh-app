// iCalendar parsing and recurrence expansion for the station's Google Calendar.
//
// A TypeScript port of tools/fetch_schedule.py that additionally
// produces *dated occurrences*: EXDATE, UNTIL/COUNT, INTERVAL, RECURRENCE-ID
// overrides and cancelled instances are honoured instead of being flattened into
// a permanent weekly grid.

import { ET, fromWall, toWall, weekday, addDays, type CivilDate, type Wall } from './time';

export interface IcsEvent {
  uid: string;
  summary: string;
  description: string;
  status: string; // CONFIRMED | TENTATIVE | CANCELLED
  startMs: number;
  endMs: number;
  rrule: string | null;
  exdates: number[];
  recurrenceIdMs: number | null;
}

export interface ParseResult {
  events: IcsEvent[];
  warnings: string[];
}

export interface Occurrence {
  uid: string;
  summary: string;
  description: string;
  startMs: number;
  endMs: number;
  recurring: boolean;
  cancelled: boolean;
}

export class IcsError extends Error {}

export function unfold(raw: string): string {
  return raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, '');
}

export function unescapeText(value: string): string {
  return value.replace(/\\([\\;,nN])/g, (_, ch: string) => (ch === 'n' || ch === 'N' ? '\n' : ch));
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+|#39);/gi, (whole, name: string) => {
    if (name[0] === '#') {
      const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[name.toLowerCase()] ?? whole;
  });
}

/** Google Calendar descriptions are rich text and arrive as HTML. */
export function stripHtml(value: string): string {
  let v = value.replace(/<br\s*\/?>|<\/p>|<\/div>/gi, '\n');
  v = v.replace(/<[^>]+>/g, '');
  v = decodeEntities(v);
  v = v.replace(/[ \t]+/g, ' ');
  v = v.replace(/\n\s*\n+/g, '\n');
  return v.trim();
}

// "Show Name - DJ Name"; dashes vary, and the LAST one separates the DJ so
// hyphenated show names ("J-J-Jams") survive.
const SPLIT_RE = /\s*[-‐-―−]\s*/g;

export function splitSummary(summary: string): { show: string; dj: string } {
  const s = summary.replace(/\s+/g, ' ').trim();
  const matches = [...s.matchAll(SPLIT_RE)];
  if (matches.length) {
    const last = matches[matches.length - 1];
    const show = s.slice(0, last.index).trim();
    const dj = s.slice(last.index! + last[0].length).trim();
    if (show && dj) return { show, dj };
  }
  return { show: s, dj: '' };
}

export function initials(name: string): string {
  const people = name.split(/\s+(?:and|&|\+|with)\s+/i).filter((p) => p.trim());
  if (people.length > 1) return people.slice(0, 2).map((p) => p.trim()[0]).join('').toUpperCase();
  const words = name.split(/[\s.]+/).filter(Boolean);
  if (!words.length) return '?';
  if (words.length === 1) return words[0][0].toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** Trim to a word boundary so a genre list never ends mid-word (fetch_schedule.shorten). */
export function shorten(text: string, limit = 58): string {
  const t = text.trim();
  if ([...t].length <= limit) return t;
  let cut = [...t].slice(0, limit + 1).join('');
  const space = cut.lastIndexOf(' ');
  if (space > limit * 0.5) cut = cut.slice(0, space);
  return cut.replace(/[ ,;/&-]+$/, '') + '…';
}

interface Prop {
  params: string;
  value: string;
}

/** Parse a DTSTART/DTEND/EXDATE/RECURRENCE-ID value list into instants. */
function parseDates(prop: Prop): { instants: number[]; allDay: boolean } {
  const tzid = /TZID=([^;:]+)/i.exec(prop.params)?.[1]?.replace(/^"|"$/g, '') ?? ET;
  const allDay = /VALUE=DATE(?!-)/i.test(prop.params) || /^\d{8}$/.test(prop.value.trim());
  const instants: number[] = [];
  for (const raw of prop.value.split(',')) {
    const v = raw.trim();
    const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(v);
    if (!m) throw new IcsError(`unparseable date ${v}`);
    const wall: Wall = { y: +m[1], mo: +m[2], d: +m[3], h: +(m[4] ?? 0), mi: +(m[5] ?? 0), s: +(m[6] ?? 0) };
    if (m[7]) {
      instants.push(Date.UTC(wall.y, wall.mo - 1, wall.d, wall.h, wall.mi, wall.s));
    } else {
      let tz = tzid;
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: tz });
      } catch {
        tz = ET;
      }
      instants.push(fromWall(wall, tz));
    }
  }
  return { instants, allDay };
}

export function parseCalendar(raw: string): ParseResult {
  const text = unfold(raw);
  if (!text.trimStart().startsWith('BEGIN:VCALENDAR')) throw new IcsError('not an iCalendar document');
  if (!/END:VCALENDAR\s*$/.test(text)) throw new IcsError('truncated iCalendar document');
  const events: IcsEvent[] = [];
  const warnings: string[] = [];

  // Only VEVENT blocks; VTIMEZONE also contains DTSTART/RRULE and must be skipped.
  const blocks = text.match(/BEGIN:VEVENT\n[\s\S]*?\nEND:VEVENT/g) ?? [];
  for (const block of blocks) {
    const props = new Map<string, Prop[]>();
    for (const line of block.split('\n').slice(1, -1)) {
      const colon = line.indexOf(':');
      if (colon < 0) continue;
      const head = line.slice(0, colon);
      const semi = head.indexOf(';');
      const key = (semi < 0 ? head : head.slice(0, semi)).toUpperCase();
      const params = semi < 0 ? '' : head.slice(semi + 1);
      const list = props.get(key) ?? [];
      list.push({ params, value: line.slice(colon + 1) });
      props.set(key, list);
    }
    const first = (k: string) => props.get(k)?.[0];
    const summary = unescapeText(first('SUMMARY')?.value ?? '').trim();
    const uid = (first('UID')?.value ?? '').trim();
    const dtstart = first('DTSTART');
    if (!dtstart || !summary) continue;

    try {
      const start = parseDates(dtstart);
      if (start.allDay) {
        warnings.push(`skipped all-day event "${summary}"`);
        continue;
      }
      const startMs = start.instants[0];
      const dtend = first('DTEND');
      const endMs = dtend ? parseDates(dtend).instants[0] : startMs + 3600_000;
      const exdates = (props.get('EXDATE') ?? []).flatMap((p) => parseDates(p).instants);
      const rid = first('RECURRENCE-ID');
      events.push({
        uid,
        summary,
        description: stripHtml(unescapeText(first('DESCRIPTION')?.value ?? '')),
        status: (first('STATUS')?.value ?? 'CONFIRMED').trim().toUpperCase(),
        startMs,
        endMs: endMs > startMs ? endMs : startMs + 3600_000,
        rrule: first('RRULE')?.value.trim() || null,
        exdates,
        recurrenceIdMs: rid ? parseDates(rid).instants[0] : null,
      });
    } catch (err) {
      warnings.push(`skipped "${summary}": ${(err as Error).message}`);
    }
  }
  return { events, warnings };
}

const BYDAY: Record<string, number> = { MO: 0, TU: 1, WE: 2, TH: 3, FR: 4, SA: 5, SU: 6 };

interface Rule {
  freq: string;
  interval: number;
  byday: number[] | null;
  untilMs: number | null;
  count: number | null;
}

function parseRule(rrule: string): Rule {
  const parts = Object.fromEntries(
    rrule.split(';').map((kv) => {
      const [k, v = ''] = kv.split('=');
      return [k.toUpperCase(), v];
    }),
  );
  let untilMs: number | null = null;
  if (parts.UNTIL) {
    const u = parseDates({ params: '', value: parts.UNTIL });
    // A date-only UNTIL includes that whole day.
    untilMs = u.allDay ? u.instants[0] + 86_400_000 - 1 : u.instants[0];
  }
  return {
    freq: (parts.FREQ ?? '').toUpperCase(),
    interval: Math.max(1, parseInt(parts.INTERVAL ?? '1', 10) || 1),
    byday: parts.BYDAY
      ? parts.BYDAY.split(',')
          .map((d: string) => BYDAY[d.replace(/^[+-]?\d+/, '').toUpperCase()])
          .filter((d: number | undefined): d is number => d !== undefined)
      : null,
    untilMs,
    count: parts.COUNT ? parseInt(parts.COUNT, 10) : null,
  };
}

/** Candidate instance start times for a recurring master, in order, up to `limitMs`. */
function* instances(ev: IcsEvent, rule: Rule, limitMs: number): Generator<number> {
  const w = toWall(ev.startMs);
  const time = { h: w.h, mi: w.mi, s: w.s };
  const startDate: CivilDate = { y: w.y, mo: w.mo, d: w.d };
  let produced = 0;
  const done = (ms: number) =>
    (rule.untilMs !== null && ms > rule.untilMs) || (rule.count !== null && produced >= rule.count) || ms > limitMs;

  if (rule.freq === 'DAILY') {
    for (let i = 0; ; i += rule.interval) {
      const ms = fromWall({ ...addDays(startDate, i), ...time });
      if (done(ms)) return;
      produced++;
      yield ms;
    }
  }
  // WEEKLY, with weeks starting Monday (RFC 5545 default WKST=MO).
  const days = [...(rule.byday?.length ? rule.byday : [weekday(startDate)])].sort((a, b) => a - b);
  const weekStart = addDays(startDate, -weekday(startDate));
  for (let week = 0; ; week += rule.interval) {
    for (const day of days) {
      const date = addDays(weekStart, week * 7 + day);
      const ms = fromWall({ ...date, ...time });
      if (ms < ev.startMs) continue;
      if (done(ms)) return;
      produced++;
      yield ms;
    }
  }
}

/**
 * Expand events into dated occurrences overlapping [fromMs, toMs).
 * Cancelled instances are returned with cancelled=true so clients can show them.
 */
export function expand(events: IcsEvent[], fromMs: number, toMs: number): { occurrences: Occurrence[]; warnings: string[] } {
  const warnings: string[] = [];
  const overrides = new Map<string, IcsEvent>();
  const masters: IcsEvent[] = [];
  for (const ev of events) {
    if (ev.recurrenceIdMs !== null) overrides.set(`${ev.uid}@${ev.recurrenceIdMs}`, ev);
    else masters.push(ev);
  }
  const masterUids = new Set(masters.filter((m) => m.rrule).map((m) => m.uid));
  const out: Occurrence[] = [];
  const push = (ev: IcsEvent, startMs: number, endMs: number, recurring: boolean, cancelled: boolean) => {
    if (endMs > fromMs && startMs < toMs) {
      out.push({ uid: ev.uid, summary: ev.summary, description: ev.description, startMs, endMs, recurring, cancelled });
    }
  };

  for (const ev of masters) {
    if (ev.status === 'CANCELLED') continue;
    const duration = ev.endMs - ev.startMs;
    if (!ev.rrule) {
      push(ev, ev.startMs, ev.endMs, false, false);
      continue;
    }
    const rule = parseRule(ev.rrule);
    if (rule.freq !== 'WEEKLY' && rule.freq !== 'DAILY') {
      warnings.push(`unsupported recurrence ${rule.freq} on "${ev.summary}"; using first instance only`);
      push(ev, ev.startMs, ev.endMs, false, false);
      continue;
    }
    const exdates = new Set(ev.exdates);
    for (const ms of instances(ev, rule, toMs)) {
      if (exdates.has(ms)) continue;
      const override = overrides.get(`${ev.uid}@${ms}`);
      if (override) {
        if (override.status === 'CANCELLED') push(ev, ms, ms + duration, true, true);
        else push({ ...override, uid: ev.uid }, override.startMs, override.endMs, true, false);
        continue;
      }
      push(ev, ms, ms + duration, true, false);
    }
  }
  // Overrides whose master is missing (or not recurring) stand alone.
  for (const ev of overrides.values()) {
    if (!masterUids.has(ev.uid) && ev.status !== 'CANCELLED') push(ev, ev.startMs, ev.endMs, false, false);
  }

  // The calendar sometimes contains duplicate one-offs shadowing recurrences.
  const seen = new Set<string>();
  const unique = out
    .sort((a, b) => a.startMs - b.startMs || Number(a.cancelled) - Number(b.cancelled) || a.summary.localeCompare(b.summary))
    .filter((o) => {
      const key = `${o.startMs}|${splitSummary(o.summary).show.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return { occurrences: unique, warnings };
}
