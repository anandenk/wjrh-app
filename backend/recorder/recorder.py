#!/usr/bin/env python3
"""
WJRH archive recorder.

Watches the API schedule, captures the live stream for each scheduled
occurrence, uploads the file, and leaves the episode in `pending_review` for
staff to publish. It never publishes anything itself.

Two destinations (docs/backend-proposal/decisions/002-archive-and-licensing.md):

  --archive-to storage   our own S3-compatible storage, through a presigned URL
  --archive-to mixcloud  the station's Mixcloud account (unlisted by default), with
                         a tracklist from /v1/recent; then registered by its key

This is the one component Cloudflare cannot host (it holds a stream connection
open for hours). In production it runs on a small always-on cloud server that
records the public stream. Standard library only. MP3 frames are
self-synchronising, so a byte-for-byte capture of the stream is a valid file.

    # watch the schedule and record shows that opted in
    python3 recorder.py --api http://127.0.0.1:8787 --shows all

    # record one occurrence now (for testing)
    python3 recorder.py --once '2026-09-30T17:00:00-04:00_amber-on-audio'

Environment: WJRH_API, WJRH_ADMIN_TOKEN, WJRH_STREAM_URL, WJRH_SPOOL,
WJRH_ARCHIVE_TO, MIXCLOUD_UPLOAD_URL, MIXCLOUD_ACCESS_TOKEN.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import threading
import time
import uuid
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


def mixcloud_upload(url: str, token: str, path: Path, fields: list[tuple[str, str]]) -> str:
    """Multipart POST to Mixcloud's upload API, streaming the file. Returns the cloudcast key."""
    boundary = uuid.uuid4().hex
    head = b"".join(
        f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode()
        for name, value in fields
    )
    head += (
        f'--{boundary}\r\nContent-Disposition: form-data; name="mp3"; filename="{path.name}"\r\n'
        "Content-Type: audio/mpeg\r\n\r\n"
    ).encode()
    tail = f"\r\n--{boundary}--\r\n".encode()
    size = len(head) + path.stat().st_size + len(tail)

    def body():
        yield head
        with path.open("rb") as fh:
            while chunk := fh.read(256 * 1024):
                yield chunk
        yield tail

    sep = "&" if "?" in url else "?"
    req = urllib.request.Request(
        f"{url}{sep}{urllib.parse.urlencode({'access_token': token})}",
        data=body(),
        method="POST",
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}", "Content-Length": str(size),
                 "User-Agent": "WJRH-recorder/0.1"},
    )
    try:
        with urllib.request.urlopen(req, timeout=1800) as res:
            result = json.loads(res.read()).get("result", {})
    except urllib.error.HTTPError as err:
        detail = err.read().decode("utf-8", "replace")[:300]
        raise RuntimeError(f"Mixcloud upload -> {err.code}: {detail}") from None
    if not result.get("success") or not result.get("key"):
        raise RuntimeError(f"Mixcloud upload did not succeed: {result}")
    return result["key"]


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

        if self.args.archive_to == "mixcloud":
            return self.publish_to_mixcloud(occ, path, duration, len(gaps))

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

    def tracklist(self, occ: dict) -> list[tuple[str, str]]:
        """Mixcloud asks for a tracklist; build it from the station-wide play history."""
        start = datetime.fromisoformat(occ["startsAt"])
        end = datetime.fromisoformat(occ["endsAt"])
        query = urllib.parse.urlencode({"since": occ["startsAt"], "limit": 100})
        try:
            items = self.api.call("GET", f"/v1/recent?{query}")["items"]
        except Exception as exc:
            log.warning("no tracklist for %s: %s", occ["id"], exc)
            return []
        plays = sorted(
            (i for i in items if i.get("title") and datetime.fromisoformat(i["startedAt"]) < end),
            key=lambda i: i["startedAt"],
        )
        fields: list[tuple[str, str]] = []
        for n, item in enumerate(plays):
            offset = max(0, int((datetime.fromisoformat(item["startedAt"]) - start).total_seconds()) + self.args.pre_roll)
            fields += [
                (f"sections-{n}-artist", item.get("artist") or ""),
                (f"sections-{n}-song", item["title"]),
                (f"sections-{n}-start_time", str(offset)),
            ]
        return fields

    def publish_to_mixcloud(self, occ: dict, path: Path, duration: int, gaps: int) -> dict:
        if not self.args.mixcloud_token:
            raise RuntimeError("MIXCLOUD_ACCESS_TOKEN is not set")
        day = datetime.fromisoformat(occ["startsAt"]).strftime("%b %-d, %Y")
        fields = [
            ("name", f"{occ['title']} ({day})"[:100]),
            ("description", f"Recorded from the WJRH 104.9 FM broadcast on {day}."),
            ("tags-0-tag", "WJRH"),
            ("tags-1-tag", "College Radio"),
            ("unlisted", "0" if self.args.mixcloud_listed else "1"),
            *self.tracklist(occ),
        ]
        key = mixcloud_upload(self.args.mixcloud_upload_url, self.args.mixcloud_token, path, fields)
        reg = self.api.call(
            "POST",
            "/v1/admin/archives",
            {
                "showId": occ["showId"],
                "occurrenceId": occ["id"],
                "recordedAt": occ["startsAt"],
                "durationSeconds": duration,
                "provider": "mixcloud",
                "mixcloudKey": key,
            },
            admin=True,
        )
        log.info("uploaded %s to Mixcloud as %s (episode %s, %ss, %d gaps) — awaiting staff review",
                 occ["id"], key, reg["episode"]["id"], duration, gaps)
        if not self.args.keep:
            path.unlink(missing_ok=True)
        return reg["episode"]

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
    p.add_argument("--archive-to", choices=("storage", "mixcloud"), default=os.environ.get("WJRH_ARCHIVE_TO", "storage"))
    p.add_argument("--mixcloud-upload-url", default=os.environ.get("MIXCLOUD_UPLOAD_URL", "http://127.0.0.1:8804/upload/"),
                   help="https://api.mixcloud.com/upload/ in production")
    p.add_argument("--mixcloud-token", default=os.environ.get("MIXCLOUD_ACCESS_TOKEN", "dev-mixcloud-token"))
    p.add_argument("--mixcloud-listed", action="store_true",
                   help="list uploads publicly on Mixcloud (default: unlisted, so only the app links to them)")
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
