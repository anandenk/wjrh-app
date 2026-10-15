#!/usr/bin/env python3
"""
End-to-end check of the local WJRH stack. Start it first with backend/scripts/dev.sh.

    python3 backend/scripts/e2e.py            # everything, including a ~3 minute archive recording
    python3 backend/scripts/e2e.py --quick    # skip the recording

Drives the fake station through failure scenarios and asserts what the API
serves, then records, reviews, publishes, plays (byte ranges) and unpublishes
an archive episode. Standard library only; leaves the mocks on their defaults.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MIXCLOUD = "http://127.0.0.1:8804"
API = "http://127.0.0.1:8787"
STREAM, NOWPLAYING, CALENDAR = "http://127.0.0.1:8801", "http://127.0.0.1:8802", "http://127.0.0.1:8803"
TOKEN = "dev-admin-token"
PASSED: list[str] = []


def request(method: str, url: str, body: dict | None = None, headers: dict | None = None) -> tuple[int, dict, dict]:
    data = json.dumps(body).encode() if body is not None else None
    hdrs = {"Content-Type": "application/json", **(headers or {})}
    req = urllib.request.Request(url, data=data, method=method, headers=hdrs)
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            raw = res.read()
            return res.status, dict(res.headers), (json.loads(raw) if raw and "json" in res.headers.get("content-type", "") else {})
    except urllib.error.HTTPError as err:
        raw = err.read()
        return err.code, dict(err.headers), (json.loads(raw) if raw.startswith(b"{") else {})


def get(path: str) -> dict:
    status, _, body = request("GET", API + path)
    assert status == 200, f"GET {path} -> {status} {body}"
    return body


def adm(method: str, path: str, body: dict | None = None) -> tuple[int, dict]:
    status, _, data = request(method, API + path, body, {"Authorization": f"Bearer {TOKEN}", "X-Actor": "e2e"})
    return status, data


def scenario(base: str, name: str) -> None:
    status, _, _ = request("POST", f"{base}/_scenario?name={name}")
    assert status == 200, f"could not set scenario {name} on {base}"


def cron(expr: str) -> None:
    urllib.request.urlopen(f"{API}/__scheduled?cron={expr.replace(' ', '+')}", timeout=60).read()


def check(name: str):
    def wrap(fn):
        def run(*a, **kw):
            print(f"• {name} … ", end="", flush=True)
            fn(*a, **kw)
            print("ok")
            PASSED.append(name)

        return run

    return wrap


@check("API and mocks are reachable")
def reachable():
    for url in (f"{API}/", f"{NOWPLAYING}/_scenario", f"{CALENDAR}/_scenario", "http://127.0.0.1:9000/"):
        try:
            urllib.request.urlopen(url, timeout=5).read()
        except urllib.error.HTTPError:
            pass
        except Exception as exc:
            raise AssertionError(f"{url} unreachable ({exc}); start backend/scripts/dev.sh first") from None


@check("legacy parser reproduces schedule.json from the calendar fixture")
def legacy_parity():
    spec = importlib.util.spec_from_file_location("fs", ROOT / "tools/fetch_schedule.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    text = (ROOT / "backend/mocks/fixtures/calendar-snapshot.ics").read_text(encoding="utf-8")
    days = mod.build(mod.parse_events(mod.unfold(text)))
    # The frozen snapshot that matches the fixture calendar, not tools/schedule-snapshot.json (the real calendar).
    assert days == json.loads((ROOT / "backend/mocks/fixtures/schedule-snapshot.json").read_text())["days"]


@check("schedule: snapshot, cancellations, and last-known-good on failure")
def schedule():
    scenario(CALENDAR, "snapshot")
    cron("*/15 * * * *")
    base = get("/v1/schedule")
    assert base["occurrences"] and not base["stale"]

    scenario(CALENDAR, "cancelled")
    cron("*/15 * * * *")
    occ = get("/v1/schedule?" + "from=" + base["from"][:10])["occurrences"]
    assert any(o["showId"] == "supercut" and o["cancelled"] for o in occ), "Supercut cancellation missing"
    assert any(o["showId"] == "basement-jams" and o["startsAt"][11:16] == "20:00" for o in occ), "moved show missing"

    scenario(CALENDAR, "malformed")
    cron("*/15 * * * *")
    assert get("/v1/schedule")["occurrences"], "malformed calendar replaced the schedule"
    assert get("/v1/health")["services"]["schedule"]["lastError"], "health did not report the bad calendar"
    scenario(CALENDAR, "snapshot")
    cron("*/15 * * * *")


@check("now-playing: normal, URL-encoded, Null, and feed outage")
def now_playing():
    scenario(NOWPLAYING, "rotating")
    time.sleep(6)
    body = get("/v1/now-playing")
    assert body["track"] and body["track"]["title"], body
    scenario(NOWPLAYING, "urlencoded")
    time.sleep(6)
    assert "+" not in get("/v1/now-playing")["track"]["artist"]
    scenario(NOWPLAYING, "Null")
    time.sleep(6)
    assert get("/v1/now-playing")["track"] is None
    scenario(NOWPLAYING, "rotating")
    time.sleep(6)
    get("/v1/now-playing")
    scenario(NOWPLAYING, "error")
    time.sleep(6)
    body = get("/v1/now-playing")
    assert body["stale"] is True and body["track"], "outage should serve the last track marked stale"
    scenario(NOWPLAYING, "rotating")


@check("recent: station-wide history without duplicates or Null entries")
def recent():
    for _ in range(3):
        cron("* * * * *")
    items = get("/v1/recent?limit=50")["items"]
    assert items, "no history recorded"
    assert all(i["title"] or i["artist"] for i in items)
    pairs = [(i["title"], i["artist"]) for i in items]
    assert all(a != b for a, b in zip(pairs, pairs[1:])), "consecutive duplicates in history"


@check("health: audio byte probe detects a silent stream")
def health():
    cron("*/5 * * * *")
    time.sleep(8)
    assert get("/v1/health")["services"]["stream"]["status"] == "ok"
    scenario(STREAM, "silent")
    cron("*/5 * * * *")
    time.sleep(9)
    assert get("/v1/health")["services"]["stream"]["status"] == "down"
    scenario(STREAM, "ok")
    cron("*/5 * * * *")


@check("join: accepted, validated, rate-limited")
def join():
    client = {"CF-Connecting-IP": f"198.51.100.{int(time.time()) % 250}"}  # fresh rate-limit bucket per run
    status, _, body = request("POST", f"{API}/v1/join", {"email": "e2e@example.edu"}, client)
    assert status == 202 and body == {"accepted": True, "confirmationRequired": True}, (status, body)
    status, _, _ = request("POST", f"{API}/v1/join", {"email": "nope"})
    assert status == 400


@check("archive: record → upload → review → publish → play (Range) → unpublish")
def archive():
    scenario(CALENDAR, "demo-now")
    cron("*/15 * * * *")
    # Amber on Audio is a one-off in the fixture, so the only occurrence this week is the demo.
    demo = [o for o in get("/v1/schedule")["occurrences"] if o["id"].endswith("_amber-on-audio")]
    assert len(demo) == 1, demo
    occurrence = demo[0]
    print(f"\n    recording {occurrence['id']} (about 3 minutes) … ", end="", flush=True)
    rec = subprocess.run(
        [sys.executable, str(ROOT / "backend/recorder/recorder.py"), "--once", occurrence["id"]],
        capture_output=True, text=True, timeout=600,
    )
    assert rec.returncode == 0, rec.stderr[-800:]
    scenario(CALENDAR, "snapshot")
    cron("*/15 * * * *")

    status, queue = adm("GET", "/v1/admin/archives?status=pending_review")
    ep = next(e for e in queue["episodes"] if e["occurrenceId"] == occurrence["id"])
    assert ep["bytes"] > 100_000 and ep["durationSeconds"] >= 60, ep
    assert not any(e["id"] == ep["id"] for e in get("/v1/shows/amber-on-audio/archives")["episodes"]), "unreviewed episode is public"

    status, _ = adm("PATCH", f"/v1/admin/archives/{ep['id']}", {"status": "published"})
    assert status == 200
    public = get("/v1/shows/amber-on-audio/archives")["episodes"]
    audio_url = next(e["audioUrl"] for e in public if e["id"] == ep["id"])
    req = urllib.request.Request(audio_url, headers={"Range": "bytes=1000-1999"})
    with urllib.request.urlopen(req, timeout=10) as res:
        assert res.status == 206 and len(res.read()) == 1000, "media host must support byte ranges"

    adm("PATCH", f"/v1/admin/archives/{ep['id']}", {"status": "unpublished"})
    assert not any(e["id"] == ep["id"] for e in get("/v1/shows/amber-on-audio/archives")["episodes"])
    status, audit = adm("GET", f"/v1/admin/audit?entityId={ep['id']}")
    actions = [e["action"] for e in audit["entries"]]
    assert actions == ["register", "status:pending_review", "status:published", "status:unpublished"], actions


@check("archive via Mixcloud: record → upload to Mixcloud → register → review → publish → widget")
def archive_mixcloud():
    scenario(CALENDAR, "demo-now")
    cron("*/15 * * * *")
    demo = [o for o in get("/v1/schedule")["occurrences"] if o["id"].endswith("_amber-on-audio")]
    assert len(demo) == 1, demo
    occurrence = demo[0]
    print(f"\n    recording {occurrence['id']} to the fake Mixcloud (about 3 minutes) … ", end="", flush=True)
    rec = subprocess.run(
        [sys.executable, str(ROOT / "backend/recorder/recorder.py"), "--once", occurrence["id"], "--archive-to", "mixcloud"],
        capture_output=True, text=True, timeout=600,
    )
    assert rec.returncode == 0, rec.stderr[-800:]
    scenario(CALENDAR, "snapshot")
    cron("*/15 * * * *")

    status, queue = adm("GET", "/v1/admin/archives?status=pending_review")
    ep = next(e for e in queue["episodes"] if e["occurrenceId"] == occurrence["id"])
    assert ep["provider"] == "mixcloud" and ep["audioUrl"] is None and ep["durationSeconds"] >= 60, ep
    key = ep["mixcloud"]["key"]
    cast = json.loads(urllib.request.urlopen(f"{MIXCLOUD}{key}", timeout=10).read())
    assert cast["unlisted"] is True, "uploads stay unlisted on Mixcloud by default"
    assert cast["sections"], "the upload carries a tracklist from /v1/recent"

    status, _ = adm("PATCH", f"/v1/admin/archives/{ep['id']}", {"status": "published"})
    assert status == 200
    public = next(e for e in get("/v1/shows/amber-on-audio/archives")["episodes"] if e["id"] == ep["id"])
    with urllib.request.urlopen(public["mixcloud"]["widgetUrl"], timeout=10) as res:
        assert "<audio" in res.read().decode(), "widget renders a player"
    adm("DELETE", f"/v1/admin/archives/{ep['id']}")


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--quick", action="store_true", help="skip the archive recording")
    args = p.parse_args()
    steps = [reachable, legacy_parity, schedule, now_playing, recent, health, join]
    if not args.quick:
        steps += [archive, archive_mixcloud]
    try:
        for step in steps:
            step()
    except AssertionError as err:
        print(f"FAILED\n  {err}")
        return 1
    finally:
        for base, name in ((STREAM, "ok"), (NOWPLAYING, "rotating"), (CALENDAR, "snapshot")):
            try:
                scenario(base, name)
            except Exception:
                pass
    print(f"\nall {len(PASSED)} checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
