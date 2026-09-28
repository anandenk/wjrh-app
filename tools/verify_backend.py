#!/usr/bin/env python3
"""Read-only verification of WJRH's public services and local schedule snapshot."""

from __future__ import annotations

import argparse
import importlib.util
import json
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / "tools"
STREAM_URL = "https://internetstreamer.lafayette.edu/"
METADATA_URL = "https://nowplaying.wjrh.org"
CALENDAR_URL = (
    "https://calendar.google.com/calendar/ical/"
    "c_7a588b3138c9250476aaac7dc81d5002c7e689fd8cd4cef1cc56737e872720ee"
    "%40group.calendar.google.com/public/basic.ics"
)
USER_AGENT = "WJRH-backend-verifier/1.0"


def fetch(url: str, *, method: str = "GET", headers: dict[str, str] | None = None) -> dict[str, Any]:
    merged = {"User-Agent": USER_AGENT}
    if headers:
        merged.update(headers)
    request = urllib.request.Request(url, method=method, headers=merged)
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            body = response.read() if method != "HEAD" else b""
            return {
                "ok": 200 <= response.status < 400,
                "status": response.status,
                "headers": {k.lower(): v for k, v in response.headers.items()},
                "body": body,
            }
    except Exception as exc:  # network and HTTP failures belong in the report
        return {"ok": False, "error": f"{type(exc).__name__}: {exc}", "headers": {}, "body": b""}


def load_schedule_parser():
    path = TOOLS / "fetch_schedule.py"
    spec = importlib.util.spec_from_file_location("wjrh_fetch_schedule", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def slots(days: dict[str, list[dict[str, Any]]]) -> list[dict[str, Any]]:
    return [slot for day in days.values() for slot in day]


def schedule_metrics(days: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    items = slots(days)
    return {
        "slots": len(items),
        "uniqueShows": len({item.get("show") for item in items}),
        "blankGenres": sum(not str(item.get("genre") or "").strip() for item in items),
        "blankDescriptions": sum(not str(item.get("description") or "").strip() for item in items),
        "blankHostBios": sum(
            not str((item.get("host") or {}).get("bio") or "").strip() for item in items
        ),
    }


def schedule_signature(days: dict[str, list[dict[str, Any]]]) -> set[tuple[str, str, str, str, str]]:
    return {
        (
            day,
            str(item.get("startsAt") or ""),
            str(item.get("endsAt") or ""),
            str(item.get("show") or ""),
            str(item.get("dj") or ""),
        )
        for day, items in days.items()
        for item in items
    }


def tuple_rows(rows: set[tuple[str, str, str, str, str]]) -> list[dict[str, str]]:
    return [
        {"day": day, "startsAt": start, "endsAt": end, "show": show, "dj": dj}
        for day, start, end, show, dj in sorted(rows)
    ]


def audit() -> dict[str, Any]:
    checked_at = datetime.now(timezone.utc).isoformat(timespec="seconds")

    stream = fetch(STREAM_URL, method="HEAD")
    stream_result = {
        "ok": stream["ok"],
        "status": stream.get("status"),
        "contentType": stream["headers"].get("content-type"),
        "icyName": stream["headers"].get("icy-name"),
        "icyBitrateKbps": stream["headers"].get("icy-br"),
        "error": stream.get("error"),
    }

    metadata = fetch(METADATA_URL, headers={"Origin": "https://www.wjrh.org"})
    metadata_json = None
    metadata_error = metadata.get("error")
    if metadata["ok"]:
        try:
            metadata_json = json.loads(metadata["body"].decode("utf-8"))
        except Exception as exc:
            metadata_error = f"Invalid JSON: {exc}"
    now = (metadata_json or {}).get("nowplaying", metadata_json or {})
    metadata_result = {
        "ok": bool(metadata["ok"] and metadata_json is not None),
        "status": metadata.get("status"),
        "contentType": metadata["headers"].get("content-type"),
        "cors": metadata["headers"].get("access-control-allow-origin"),
        "fields": sorted(now.keys()) if isinstance(now, dict) else [],
        "artistPresent": bool(now.get("ARTIST") or now.get("artist")) if isinstance(now, dict) else False,
        "titlePresent": bool(now.get("TITLE") or now.get("title")) if isinstance(now, dict) else False,
        "albumPresent": bool(now.get("ALBUM") or now.get("album")) if isinstance(now, dict) else False,
        "error": metadata_error,
    }

    calendar = fetch(CALENDAR_URL)
    calendar_text = calendar["body"].decode("utf-8", "replace") if calendar["ok"] else ""
    calendar_result: dict[str, Any] = {
        "ok": bool(calendar["ok"] and calendar_text.startswith("BEGIN:VCALENDAR")),
        "status": calendar.get("status"),
        "bytes": len(calendar["body"]),
        "vevents": calendar_text.count("BEGIN:VEVENT"),
        "weeklyRules": calendar_text.count("FREQ=WEEKLY"),
        "error": calendar.get("error"),
    }

    local_schedule = json.loads((TOOLS / "schedule.json").read_text(encoding="utf-8"))
    local_days = local_schedule.get("days", {})
    local_result = {
        "generatedAt": local_schedule.get("generatedAt"),
        **schedule_metrics(local_days),
    }

    live_result: dict[str, Any] | None = None
    drift: dict[str, Any] | None = None
    if calendar_result["ok"]:
        parser = load_schedule_parser()
        live_days = parser.build(parser.parse_events(parser.unfold(calendar_text)))
        live_result = schedule_metrics(live_days)
        local_sig = schedule_signature(local_days)
        live_sig = schedule_signature(live_days)
        drift = {
            "matches": local_sig == live_sig,
            "localOnly": tuple_rows(local_sig - live_sig),
            "liveOnly": tuple_rows(live_sig - local_sig),
        }

    overall = all([stream_result["ok"], metadata_result["ok"], calendar_result["ok"]])
    return {
        "checkedAt": checked_at,
        "ok": overall,
        "stream": stream_result,
        "metadata": metadata_result,
        "calendar": calendar_result,
        "localSchedule": local_result,
        "liveNormalizedSchedule": live_result,
        "scheduleDrift": drift,
    }


def render(report: dict[str, Any]) -> str:
    lines = [f"WJRH backend verification — {report['checkedAt']}"]
    stream = report["stream"]
    lines.append(
        f"stream: {'OK' if stream['ok'] else 'FAIL'}; status={stream.get('status')}; "
        f"type={stream.get('contentType')}; bitrate={stream.get('icyBitrateKbps')} kbps"
    )
    metadata = report["metadata"]
    lines.append(
        f"metadata: {'OK' if metadata['ok'] else 'FAIL'}; status={metadata.get('status')}; "
        f"cors={metadata.get('cors')}; fields={','.join(metadata.get('fields') or [])}; "
        f"artist={metadata['artistPresent']}; title={metadata['titlePresent']}; "
        f"album={metadata['albumPresent']}"
    )
    calendar = report["calendar"]
    lines.append(
        f"calendar: {'OK' if calendar['ok'] else 'FAIL'}; status={calendar.get('status')}; "
        f"events={calendar.get('vevents')}; weekly={calendar.get('weeklyRules')}"
    )
    local = report["localSchedule"]
    lines.append(
        f"local schedule: generated={local.get('generatedAt')}; slots={local['slots']}; "
        f"shows={local['uniqueShows']}; blank genres={local['blankGenres']}; "
        f"blank bios={local['blankHostBios']}"
    )
    live = report.get("liveNormalizedSchedule")
    if live:
        lines.append(
            f"live normalized schedule: slots={live['slots']}; shows={live['uniqueShows']}; "
            f"blank genres={live['blankGenres']}; blank bios={live['blankHostBios']}"
        )
    drift = report.get("scheduleDrift")
    if drift:
        lines.append(f"schedule drift: {'NONE' if drift['matches'] else 'DETECTED'}")
        for item in drift["localOnly"]:
            lines.append(
                "  local only: {day} {startsAt}-{endsAt} {show} — {dj}".format(**item)
            )
        for item in drift["liveOnly"]:
            lines.append(
                "  live only:  {day} {startsAt}-{endsAt} {show} — {dj}".format(**item)
            )
    for section in ("stream", "metadata", "calendar"):
        error = report[section].get("error")
        if error:
            lines.append(f"{section} error: {error}")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", action="store_true", help="emit the full report as JSON")
    args = parser.parse_args()
    report = audit()
    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print(render(report))
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())

