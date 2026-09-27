#!/usr/bin/env python3
"""
Build Google-Calendar-style ICS fixtures for the mock station.

The sandbox that produced this workspace could not reach calendar.google.com, so
the snapshot is RECONSTRUCTED from the committed wjrh-app/schedule.json (which was
itself generated from the live calendar). It mirrors Google's output format:
TZID-qualified DTSTART/DTEND, weekly RRULEs, escaped text and 75-octet folding.

Replace fixtures/calendar-snapshot.ics with a real capture when network access
allows (see backend/README.md); every test that uses it should still pass.

    python3 backend/mocks/calendar_fixture.py            # rewrite the snapshot
    python3 backend/mocks/calendar_fixture.py --scenario drift --stdout
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[2]
SCHEDULE = ROOT / "wjrh-app" / "schedule.json"
FIXTURES = Path(__file__).resolve().parent / "fixtures"
ET = ZoneInfo("America/New_York")
DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
ICS_DAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"]

# Semester anchor for recurring events, and the week the calendar's one-off
# events actually fell in (schedule.json was generated on 2026-09-18).
SEMESTER_START = date(2026, 8, 31)
ONE_OFF_WEEK = date(2026, 9, 14)
DTSTAMP = "20260918T030403Z"

SCENARIOS = ("snapshot", "drift", "cancelled", "empty", "demo-now")

VTIMEZONE = """BEGIN:VTIMEZONE
TZID:America/New_York
X-LIC-LOCATION:America/New_York
BEGIN:DAYLIGHT
TZOFFSETFROM:-0500
TZOFFSETTO:-0400
TZNAME:EDT
DTSTART:19700308T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:-0400
TZOFFSETTO:-0500
TZNAME:EST
DTSTART:19701101T020000
RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU
END:STANDARD
END:VTIMEZONE"""


def escape(text: str) -> str:
    return (
        text.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")
    )


def fold(line: str) -> str:
    """RFC 5545 folding: 75 octets, continuation lines start with one space."""
    out, current = [], b""
    for ch in line:
        enc = ch.encode("utf-8")
        limit = 75 if not out else 74
        if len(current) + len(enc) > limit:
            out.append(current.decode("utf-8"))
            current = b""
        current += enc
    out.append(current.decode("utf-8"))
    return "\r\n ".join(out)


def local(d: date, hhmm: str) -> str:
    h, m = hhmm.split(":")
    return f"{d:%Y%m%d}T{int(h):02d}{int(m):02d}00"


def vevent(
    *,
    uid: str,
    summary: str,
    day: date,
    start: str,
    end: str,
    description: str = "",
    rrule: str | None = None,
    exdates: list[str] | None = None,
    recurrence_id: str | None = None,
    status: str = "CONFIRMED",
) -> str:
    end_day = day if end > start else day + timedelta(days=1)
    lines = [
        "BEGIN:VEVENT",
        f"DTSTART;TZID=America/New_York:{local(day, start)}",
        f"DTEND;TZID=America/New_York:{local(end_day, end)}",
    ]
    if rrule:
        lines.append(f"RRULE:{rrule}")
    for ex in exdates or []:
        lines.append(f"EXDATE;TZID=America/New_York:{ex}")
    if recurrence_id:
        lines.append(f"RECURRENCE-ID;TZID=America/New_York:{recurrence_id}")
    lines += [
        f"DTSTAMP:{DTSTAMP}",
        f"UID:{uid}",
        f"CREATED:{DTSTAMP}",
        f"DESCRIPTION:{escape(description)}",
        f"LAST-MODIFIED:{DTSTAMP}",
        "LOCATION:",
        "SEQUENCE:0",
        f"STATUS:{status}",
        f"SUMMARY:{escape(summary)}",
        "TRANSP:OPAQUE",
        "END:VEVENT",
    ]
    return "\r\n".join(fold(line) for line in lines)


def load_slots() -> list[dict]:
    data = json.loads(SCHEDULE.read_text(encoding="utf-8"))
    slots = []
    for idx, key in enumerate(DAY_KEYS):
        for slot in data["days"].get(key, []):
            slots.append({**slot, "weekday": idx})
    return slots


def next_weekday(today: date, weekday: int) -> date:
    return today + timedelta(days=(weekday - today.weekday()) % 7 or 7)


def build(scenario: str = "snapshot", *, now: datetime | None = None, demo_minutes: int = 2) -> str:
    if scenario not in SCENARIOS:
        raise ValueError(f"unknown scenario {scenario!r}; expected one of {SCENARIOS}")
    now = (now or datetime.now(ET)).astimezone(ET)
    slots = [] if scenario == "empty" else load_slots()
    events: list[str] = []

    if scenario == "drift":
        # The two differences observed between the snapshot and the live calendar
        # on 2026-09-25 (docs/backend/CURRENT_CAPABILITIES.md).
        slots = [s for s in slots if not (s["show"] == "API on Air" and s["weekday"] == 4)]
        for s in slots:
            if s["show"] == "The Bit":
                s["endsAt"] = "21:00"

    overrides: dict[str, dict] = {}
    if scenario == "cancelled":
        # Relative to "now" so the changes always land in the coming week.
        overrides = {
            "The Rodeo": {"kind": "exdate"},
            "Supercut": {"kind": "cancel"},
            "Basement Jams": {"kind": "move", "start": "20:00", "end": "21:00"},
        }

    for s in slots:
        summary = f"{s['show']} - {s['dj']}" if s["dj"] else s["show"]
        if s["recurring"]:
            first = SEMESTER_START + timedelta(days=s["weekday"])
            rrule = f"FREQ=WEEKLY;BYDAY={ICS_DAYS[s['weekday']]}"
            change = overrides.get(s["show"])
            exdates = []
            if change:
                target = next_weekday(now.date(), s["weekday"])
                rid = local(target, s["startsAt"])
                if change["kind"] == "exdate":
                    exdates.append(rid)
                else:
                    events.append(
                        vevent(
                            uid=s["uid"],
                            summary=summary,
                            day=target,
                            start=change.get("start", s["startsAt"]),
                            end=change.get("end", s["endsAt"]),
                            description=s["description"],
                            recurrence_id=rid,
                            status="CANCELLED" if change["kind"] == "cancel" else "CONFIRMED",
                        )
                    )
            events.append(
                vevent(
                    uid=s["uid"],
                    summary=summary,
                    day=first,
                    start=s["startsAt"],
                    end=s["endsAt"],
                    description=s["description"],
                    rrule=rrule,
                    exdates=exdates,
                )
            )
        else:
            events.append(
                vevent(
                    uid=s["uid"],
                    summary=summary,
                    day=ONE_OFF_WEEK + timedelta(days=s["weekday"]),
                    start=s["startsAt"],
                    end=s["endsAt"],
                    description=s["description"],
                )
            )

    if scenario == "demo-now":
        # A one-off special starting at the next whole minute, so the archive
        # recorder can be exercised end to end in a few minutes.
        start = (now + timedelta(minutes=1)).replace(second=0, microsecond=0)
        end = start + timedelta(minutes=demo_minutes)
        events.append(
            vevent(
                uid=f"demo-{start:%Y%m%dT%H%M}@mock.wjrh",
                summary="Amber on Audio - Amber",
                day=start.date(),
                start=f"{start:%H:%M}",
                end=f"{end:%H:%M}",
                description="Recorder demo occurrence generated by the mock calendar.",
            )
        )

    header = [
        "BEGIN:VCALENDAR",
        "PRODID:-//Google Inc//Google Calendar 70.9054//EN",
        "VERSION:2.0",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:WJRH Schedule (mock)",
        "X-WR-TIMEZONE:America/New_York",
    ]
    body = "\r\n".join(header) + "\r\n" + VTIMEZONE.replace("\n", "\r\n") + "\r\n"
    if events:
        body += "\r\n".join(events) + "\r\n"
    return body + "END:VCALENDAR\r\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--scenario", default="snapshot", choices=SCENARIOS)
    parser.add_argument("--stdout", action="store_true")
    args = parser.parse_args()
    text = build(args.scenario)
    if args.stdout:
        sys.stdout.write(text)
    else:
        dest = FIXTURES / f"calendar-{args.scenario}.ics"
        dest.write_bytes(text.encode("utf-8"))
        print(f"wrote {dest.relative_to(ROOT)} ({text.count('BEGIN:VEVENT')} events)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
