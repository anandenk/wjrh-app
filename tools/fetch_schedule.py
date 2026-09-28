#!/usr/bin/env python3
"""
Snapshot WJRH's public Google Calendar into tools/schedule.json (a flat weekly grid).

This is today's schedule pipeline: the station edits the calendar, and someone runs

    python3 tools/fetch_schedule.py

The proposed backend (docs/backend/API_CONTRACTS.md) replaces this manual step with an
automatic refresh that also handles cancelled and moved shows.
"""

import html as html_mod
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

CALENDAR_ID = (
    "c_7a588b3138c9250476aaac7dc81d5002c7e689fd8cd4cef1cc56737e872720ee"
    "@group.calendar.google.com"
)
ICS_URL = (
    "https://calendar.google.com/calendar/ical/"
    + urllib.parse.quote(CALENDAR_ID, safe="")
    + "/public/basic.ics"
)

ET = ZoneInfo("America/New_York")
DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
ICS_DAY = {"MO": 0, "TU": 1, "WE": 2, "TH": 3, "FR": 4, "SA": 5, "SU": 6}


def unfold(raw):
    """ICS folds long lines with CRLF + a single leading space or tab."""
    return raw.replace("\r\n", "\n").replace("\n ", "").replace("\n\t", "")


def unescape(value):
    out = []
    i = 0
    while i < len(value):
        ch = value[i]
        if ch == "\\" and i + 1 < len(value):
            nxt = value[i + 1]
            out.append({"n": "\n", "N": "\n"}.get(nxt, nxt))
            i += 2
            continue
        out.append(ch)
        i += 1
    return "".join(out)


def strip_html(value):
    """Google Calendar descriptions are rich text and arrive as HTML."""
    value = re.sub(r"(?i)<br\s*/?>|</p>|</div>", "\n", value)
    value = re.sub(r"<[^>]+>", "", value)
    value = html_mod.unescape(value)
    value = re.sub(r"[ \t]+", " ", value)
    value = re.sub(r"\n\s*\n+", "\n", value)
    return value.strip()


def parse_dt(prop, value):
    """Return a timezone-aware ET datetime for a DTSTART/DTEND line."""
    value = value.strip()
    if value.endswith("Z"):
        naive = datetime.strptime(value, "%Y%m%dT%H%M%SZ")
        return naive.replace(tzinfo=ZoneInfo("UTC")).astimezone(ET)
    tzid = None
    m = re.search(r"TZID=([^;:]+)", prop)
    if m:
        tzid = m.group(1)
    if "T" not in value:  # all-day event
        return datetime.strptime(value, "%Y%m%d").replace(tzinfo=ET)
    naive = datetime.strptime(value, "%Y%m%dT%H%M%S")
    try:
        return naive.replace(tzinfo=ZoneInfo(tzid) if tzid else ET).astimezone(ET)
    except Exception:
        return naive.replace(tzinfo=ET)


# The calendar convention is "Show Name - DJ Name". Separators are inconsistent
# in practice (spaced, unspaced, en/em dashes), so accept all of them and split
# on the LAST one so show names containing a hyphen survive.
SPLIT_RE = re.compile(r"\s*[-‐-―−]\s*")


def split_summary(summary):
    summary = re.sub(r"\s+", " ", summary).strip()
    # Split on the LAST separator only, so hyphenated show names ("J-J-Jams")
    # keep their internal hyphens instead of being flattened to spaces.
    matches = list(SPLIT_RE.finditer(summary))
    if matches:
        last = matches[-1]
        show, dj = summary[: last.start()].strip(), summary[last.end() :].strip()
        if show and dj:
            return show, dj
    return summary, ""


def initials(name):
    """Initials for the host square. Co-hosted shows take one letter per person."""
    people = [p for p in re.split(r"(?i)\s+(?:and|&|\+|with)\s+", name) if p.strip()]
    if len(people) > 1:
        letters = [p.strip()[0] for p in people[:2] if p.strip()]
        return "".join(letters).upper()
    words = [w for w in re.split(r"[\s.]+", name) if w]
    if not words:
        return "?"
    if len(words) == 1:
        return words[0][0].upper()
    return (words[0][0] + words[1][0]).upper()


def parse_events(text):
    events = []
    # Only VEVENT blocks; VTIMEZONE also contains DTSTART/RRULE and must be skipped.
    for block in re.findall(r"BEGIN:VEVENT\n(.*?)\nEND:VEVENT", text, re.S):
        fields = {}
        for line in block.split("\n"):
            if ":" not in line:
                continue
            prop, _, value = line.partition(":")
            key = prop.split(";")[0].upper()
            fields.setdefault(key, (prop, value))
        if "DTSTART" not in fields or "SUMMARY" not in fields:
            continue
        if fields.get("STATUS", ("", ""))[1].strip() == "CANCELLED":
            continue

        start = parse_dt(*fields["DTSTART"])
        end = parse_dt(*fields["DTEND"]) if "DTEND" in fields else start + timedelta(hours=1)
        summary = unescape(fields["SUMMARY"][1]).strip()
        if not summary:
            continue
        description = strip_html(unescape(fields.get("DESCRIPTION", ("", ""))[1]))
        rrule = fields.get("RRULE", ("", ""))[1]

        if "FREQ=WEEKLY" in rrule:
            m = re.search(r"BYDAY=([A-Z,]+)", rrule)
            # No BYDAY means "repeat on the weekday DTSTART falls on".
            weekdays = (
                [ICS_DAY[d] for d in m.group(1).split(",") if d in ICS_DAY]
                if m
                else [start.weekday()]
            )
        else:
            weekdays = [start.weekday()]  # one-off; place it on its own weekday

        show, dj = split_summary(summary)
        for wd in weekdays:
            events.append(
                {
                    "weekday": wd,
                    "uid": fields.get("UID", ("", ""))[1].strip(),
                    "show": show,
                    "dj": dj,
                    "description": description,
                    "startMin": start.hour * 60 + start.minute,
                    "endMin": end.hour * 60 + end.minute,
                    "start": f"{start.hour:02d}:{start.minute:02d}",
                    "end": f"{end.hour:02d}:{end.minute:02d}",
                    "recurring": "FREQ=WEEKLY" in rrule,
                }
            )
    return events


def shorten(text, limit=58):
    """Trim to a word boundary so a genre list never ends mid-word."""
    text = text.strip()
    if len(text) <= limit:
        return text
    cut = text[: limit + 1]
    space = cut.rfind(" ")
    if space > limit * 0.5:
        cut = cut[:space]
    return cut.rstrip(" ,;/&-") + "\u2026"


def build(events):
    days = {k: [] for k in DAY_KEYS}
    seen = set()
    for ev in sorted(events, key=lambda e: (e["weekday"], e["startMin"], e["show"])):
        key = (ev["weekday"], ev["startMin"], ev["show"].lower())
        if key in seen:  # calendar contains duplicate one-offs shadowing recurrences
            continue
        seen.add(key)
        slot_id = re.sub(r"[^a-z0-9]+", "-", ev["show"].lower()).strip("-") or "show"
        days[DAY_KEYS[ev["weekday"]]].append(
            {
                "id": f"{DAY_KEYS[ev['weekday']]}-{ev['start'].replace(':', '')}-{slot_id}",
                "uid": ev["uid"],
                "startsAt": ev["start"],
                "endsAt": ev["end"],
                "startMin": ev["startMin"],
                "endMin": ev["endMin"],
                "show": ev["show"],
                "dj": ev["dj"],
                # The station does not record genre as a field. When a DJ writes a
                # description, the first line is almost always the genre list.
                "genre": shorten(ev["description"].split("\n")[0]) if ev["description"] else "",
                "description": ev["description"],
                "host": {"name": ev["dj"], "initials": initials(ev["dj"]), "bio": ""},
                "recurring": ev["recurring"],
            }
        )
    return days


def main():
    print(f"Fetching {ICS_URL[:78]}…")
    try:
        with urllib.request.urlopen(ICS_URL, timeout=30) as resp:
            raw = resp.read().decode("utf-8", "replace")
    except Exception as exc:
        print(f"  FAILED: {exc}", file=sys.stderr)
        print("  schedule.json left unchanged.", file=sys.stderr)
        return 1

    events = parse_events(unfold(raw))
    days = build(events)
    out = {
        "tz": "America/New_York",
        "generatedAt": datetime.now(ET).isoformat(timespec="seconds"),
        "source": "Google Calendar (public ICS)",
        "days": days,
    }

    dest = os.path.join(os.path.dirname(os.path.abspath(__file__)), "schedule.json")
    with open(dest, "w", encoding="utf-8") as fh:
        json.dump(out, fh, indent=2, ensure_ascii=False)
        fh.write("\n")

    total = sum(len(v) for v in days.values())
    print(f"Wrote {dest} — {total} slots")
    for k in DAY_KEYS:
        names = ", ".join(s["show"] for s in days[k]) or "(none)"
        print(f"  {k}: {len(days[k]):>2}  {names[:88]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
