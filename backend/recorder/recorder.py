#!/usr/bin/env python3
"""
WJRH archive recorder.

Watches the API schedule, captures the live stream for each scheduled
occurrence, uploads the file through a presigned URL, and leaves the episode in
`pending_review` for staff to publish. It never publishes anything itself.

This is the one component Cloudflare cannot host (it holds a stream connection
open for hours). In production it runs on an always-on machine: a booth PC, a
Raspberry Pi, or a Lafayette VM. Standard library only. MP3 frames are
self-synchronising, so a byte-for-byte capture of the stream is a valid file.

    # watch the schedule and record shows that opted in
    python3 recorder.py --api http://127.0.0.1:8787 --shows all

    # record one occurrence now (for testing)
    python3 recorder.py --once '2026-09-30T17:00:00-04:00_amber-on-audio'

Environment: WJRH_API, WJRH_ADMIN_TOKEN, WJRH_STREAM_URL, WJRH_SPOOL.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

ET = ZoneInfo("America/New_York")
log = logging.getLogger("recorder")


class Api:
    def __init__(self, base: str, token: str):
        self.base = base.rstrip("/")
        self.token = token

    def call(self, method: str, path: str, body: dict | None = None, *, admin: bool = False) -> dict:
        headers = {"Accept": "application/json", "User-Agent": "WJRH-recorder/0.1", "X-Actor": "recorder"}
        data = None
        if body is not None:
            data = json.dumps(body).encode()
            headers["Content-Type"] = "application/json"
        if admin:
            headers["Authorization"] = f"Bearer {self.token}"
        req = urllib.request.Request(self.base + path, data=data, method=method, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=30) as res:
                raw = res.read()
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as err:
            detail = err.read().decode("utf-8", "replace")[:300]
            raise RuntimeError(f"{method} {path} -> {err.code}: {detail}") from None

    def occurrences(self, day: datetime) -> list[dict]:
        today = day.astimezone(ET).date()
        query = urllib.parse.urlencode({"from": today.isoformat(), "to": (today + timedelta(days=1)).isoformat()})
        return self.call("GET", f"/v1/schedule?{query}")["occurrences"]


def capture(stream_url: str, dest: Path, until: float, stop: threading.Event) -> tuple[int, list[str]]:
    """Append stream bytes to dest until `until` (epoch seconds). Reconnects on drops."""
    written, gaps = 0, []
    with dest.open("ab") as out:
        while time.time() < until and not stop.is_set():
            try:
                req = urllib.request.Request(stream_url, headers={"User-Agent": "WJRH-recorder/0.1", "Icy-MetaData": "0"})
                with urllib.request.urlopen(req, timeout=15) as res:
                    ctype = res.headers.get("Content-Type", "")
                    if not ctype.startswith("audio/"):
                        raise RuntimeError(f"stream returned {ctype!r}")
                    while time.time() < until and not stop.is_set():
                        chunk = res.read(16 * 1024)
                        if not chunk:
                            raise RuntimeError("stream ended")
                        out.write(chunk)
                        written += len(chunk)
            except Exception as exc:  # network drops must not end the recording
                stamp = datetime.now(ET).isoformat(timespec="seconds")
                gaps.append(f"{stamp}: {exc}")
                log.warning("stream interrupted (%s); retrying", exc)
                stop.wait(3)
    return written, gaps


def estimate_duration(path: Path, bitrate_kbps: int) -> int:
    try:  # precise when mutagen is installed; the byte estimate is fine for CBR streams
        from mutagen.mp3 import MP3  # type: ignore

        return max(1, round(MP3(path).info.length))
    except Exception:
        return max(1, round(path.stat().st_size / (bitrate_kbps * 1000 / 8)))


def upload(url: str, path: Path, content_type: str) -> None:
    size = path.stat().st_size
    with path.open("rb") as fh:
        req = urllib.request.Request(
            url, data=fh, method="PUT", headers={"Content-Type": content_type, "Content-Length": str(size)}
        )
        with urllib.request.urlopen(req, timeout=600) as res:
            if res.status >= 300:
                raise RuntimeError(f"upload failed: {res.status}")


class Recorder:
    def __init__(self, args: argparse.Namespace):
        self.args = args
        self.api = Api(args.api, args.token)
        self.spool = Path(args.spool)
        self.spool.mkdir(parents=True, exist_ok=True)
        self.state_file = self.spool / "handled.json"
        self.handled: set[str] = set(json.loads(self.state_file.read_text())) if self.state_file.exists() else set()
        self.lock = threading.Lock()
        self.stop = threading.Event()
        self.threads: list[threading.Thread] = []

    def mark(self, occurrence_id: str) -> None:
        with self.lock:
            self.handled.add(occurrence_id)
            self.state_file.write_text(json.dumps(sorted(self.handled)[-500:]))

    def wanted(self, occ: dict) -> bool:
        if occ["cancelled"] or not occ.get("hasProfile"):
            return False
        shows = self.args.shows
        return shows == "all" or occ["showId"] in {s.strip() for s in shows.split(",")}

    def record(self, occ: dict) -> dict | None:
        start = datetime.fromisoformat(occ["startsAt"]).timestamp()
        end = datetime.fromisoformat(occ["endsAt"]).timestamp()
        begin = start - self.args.pre_roll
        until = end + self.args.post_roll
        if time.time() < begin:
            log.info("waiting %.0fs for %s", begin - time.time(), occ["id"])
            if self.stop.wait(begin - time.time()):
                return None
        late = max(0.0, time.time() - start)
        if late > 5:
            log.warning("%s started %.0fs ago; the recording will be partial", occ["id"], late)
        safe = occ["id"].replace(":", "").replace("+", "p")
        path = self.spool / f"{safe}.mp3"
        path.unlink(missing_ok=True)
        log.info("recording %s until %s", occ["id"], datetime.fromtimestamp(until, ET).strftime("%H:%M:%S"))
        written, gaps = capture(self.args.stream_url, path, until, self.stop)
        if written == 0:
            log.error("no audio captured for %s", occ["id"])
            return None
        duration = estimate_duration(path, self.args.bitrate)
        scheduled = end - start
        if duration < scheduled * 0.5:
            log.warning("%s: captured %ss of a %ss slot", occ["id"], duration, int(scheduled))

        reg = self.api.call(
            "POST",
            "/v1/admin/archives",
            {
                "showId": occ["showId"],
                "occurrenceId": occ["id"],
                "recordedAt": occ["startsAt"],
                "durationSeconds": duration,
                "mimeType": "audio/mpeg",
                "description": None,
            },
            admin=True,
        )
        episode_id = reg["episode"]["id"]
        upload(reg["upload"]["url"], path, "audio/mpeg")
        result = self.api.call("PATCH", f"/v1/admin/archives/{episode_id}", {"status": "pending_review"}, admin=True)
        log.info(
            "uploaded %s as episode %s (%s bytes, %ss, %d gaps) — awaiting staff review",
            occ["id"], episode_id, result["episode"]["bytes"], duration, len(gaps),
        )
        if not self.args.keep:
            path.unlink(missing_ok=True)
        return result["episode"]

    def spawn(self, occ: dict) -> None:
        self.mark(occ["id"])

        def run():
            try:
                self.record(occ)
            except Exception:
                log.exception("recording %s failed", occ["id"])

        t = threading.Thread(target=run, name=occ["id"], daemon=True)
        t.start()
        self.threads.append(t)

    def watch(self) -> None:
        log.info("watching schedule at %s (shows: %s)", self.args.api, self.args.shows)
        while not self.stop.is_set():
            try:
                now = time.time()
                for occ in self.api.occurrences(datetime.now(timezone.utc)):
                    if occ["id"] in self.handled or not self.wanted(occ):
                        continue
                    start = datetime.fromisoformat(occ["startsAt"]).timestamp()
                    end = datetime.fromisoformat(occ["endsAt"]).timestamp()
                    # Pick up anything starting within the look-ahead, or already on air.
                    if start - self.args.lookahead <= now < end:
                        self.spawn(occ)
            except Exception as exc:
                log.warning("schedule poll failed: %s", exc)
            self.stop.wait(self.args.poll)

    def once(self, occurrence_id: str) -> int:
        day = datetime.fromisoformat(occurrence_id.split("_", 1)[0])
        for occ in self.api.occurrences(day):
            if occ["id"] == occurrence_id:
                return 0 if self.record(occ) else 1
        log.error("occurrence %s not found in the schedule", occurrence_id)
        return 1


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--api", default=os.environ.get("WJRH_API", "http://127.0.0.1:8787"))
    p.add_argument("--token", default=os.environ.get("WJRH_ADMIN_TOKEN", "dev-admin-token"))
    p.add_argument("--stream-url", default=os.environ.get("WJRH_STREAM_URL", "http://127.0.0.1:8801/"))
    p.add_argument("--spool", default=os.environ.get("WJRH_SPOOL", str(Path(__file__).resolve().parents[1] / ".dev-state" / "recorder")))
    p.add_argument("--shows", default=os.environ.get("WJRH_RECORD_SHOWS", ""),
                   help="comma-separated show IDs cleared for archiving, or 'all'")
    p.add_argument("--once", metavar="OCCURRENCE_ID")
    p.add_argument("--pre-roll", type=int, default=0, help="seconds to start early")
    p.add_argument("--post-roll", type=int, default=0, help="seconds to keep recording after the slot")
    p.add_argument("--lookahead", type=int, default=90)
    p.add_argument("--poll", type=int, default=15)
    p.add_argument("--bitrate", type=int, default=128)
    p.add_argument("--keep", action="store_true", help="keep local files after upload")
    args = p.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s", datefmt="%H:%M:%S")

    rec = Recorder(args)
    if args.once:
        args.shows = args.shows or "all"
        return rec.once(args.once)
    if not args.shows:
        p.error("--shows is required: list the show IDs cleared for archiving, or 'all'")
    try:
        rec.watch()
    except KeyboardInterrupt:
        rec.stop.set()
    return 0


if __name__ == "__main__":
    sys.exit(main())
