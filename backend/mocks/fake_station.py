#!/usr/bin/env python3
"""
Fake WJRH station: local stand-ins for the three production upstreams.

    python3 backend/mocks/fake_station.py

  :8801  stream     endless MP3 at 128 kbps, Shoutcast-style ICY headers, NO CORS
                    (like internetstreamer.lafayette.edu)
  :8802  nowplaying {"nowplaying": {"ARTIST", "TITLE"}} served as binary/octet-stream
                    with Access-Control-Allow-Origin: * (like nowplaying.wjrh.org)
  :8803  calendar   Google-style public ICS at /basic.ics
  :8804  mixcloud   upload API, cloudcast lookup and a stand-in player (fake_mixcloud.py)

Each server switches behaviour at runtime, so failure modes can be tested
without restarting anything:

    curl -X POST 'localhost:8802/_scenario?name=Null'
    curl localhost:8802/_scenario            # show current + available

Standard library only; no audio in the fixtures is real music.
"""

from __future__ import annotations

import argparse
import json
import sys
import threading
import time
import urllib.parse
from datetime import datetime, timedelta, timezone
from email.utils import format_datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import calendar_fixture  # noqa: E402
import fake_mixcloud  # noqa: E402

FIXTURES = Path(__file__).resolve().parent / "fixtures"
BYTES_PER_SECOND = 128_000 // 8

# Fictional tracks (the same invented names the design prototype uses).
TRACKS = [
    ("Cellophane Wing", "Miri Vale"),
    ("Hollowpoint Blue", "Ada Kray"),
    ("Nine Volt Sermon", "Cousin Marbles"),
    ("Slow Iron", "Nell Abiodun"),
    ("Perennial Static", "Bright Antenna"),
    ("Foxglove", "The Hardy Boys Club"),
    ("Low Ceiling", "Iona Pryce"),
    ("Café & Crème", "Señor Ñandú"),  # exercises URL-decoding of non-ASCII
]


class Scenario:
    """Thread-safe current scenario plus when it was selected."""

    def __init__(self, name: str, choices: tuple[str, ...]):
        self.choices = choices
        self.lock = threading.Lock()
        self.set(name)

    def set(self, name: str) -> None:
        if name not in self.choices:
            raise ValueError(name)
        with self.lock:
            self.name = name
            self.since = time.time()

    def get(self) -> tuple[str, float]:
        with self.lock:
            return self.name, self.since


class Base(BaseHTTPRequestHandler):
    scenario: Scenario
    server_version = "WJRHMock/1.0"

    def log_message(self, fmt, *args):  # quieter default logging
        sys.stderr.write(f"[{self.label}] {fmt % args}\n")

    label = "mock"

    def send_text(self, code: int, body: str, ctype: str = "text/plain; charset=utf-8", extra=None):
        data = body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(data)

    def handle_control(self) -> bool:
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path != "/_scenario":
            return False
        if self.command == "POST":
            name = urllib.parse.parse_qs(parsed.query).get("name", [""])[0]
            try:
                self.scenario.set(name)
            except ValueError:
                self.send_text(400, json.dumps({"error": f"unknown scenario {name!r}", "choices": self.scenario.choices}), "application/json")
                return True
        name, since = self.scenario.get()
        self.send_text(
            200,
            json.dumps({"scenario": name, "since": since, "choices": self.scenario.choices}),
            "application/json",
            {"Access-Control-Allow-Origin": "*"},
        )
        return True

    def do_POST(self):
        if not self.handle_control():
            self.send_text(405, "method not allowed")


class StreamHandler(Base):
    label = "stream"
    protocol_version = "HTTP/1.0"  # Shoutcast v1 style: no chunking, close to end

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        if self.handle_control():
            return
        name, _ = self.scenario.get()
        if name == "down":
            self.send_text(503, "stream unavailable")
            return
        self.send_response(200)
        self.send_header("Content-Type", "audio/mpeg")
        self.send_header("icy-name", "WJRH 104.9 FM (mock)")
        self.send_header("icy-genre", "Freeform")
        self.send_header("icy-br", "128")
        self.send_header("icy-pub", "1")
        self.send_header("Cache-Control", "no-cache, no-store")
        # Deliberately no Access-Control-Allow-Origin: the real stream has none.
        self.end_headers()
        if self.command == "HEAD":
            return
        audio = (FIXTURES / "tone.mp3").read_bytes()
        chunk = BYTES_PER_SECOND // 4
        pos = 0
        # A small burst first (as Shoutcast does) so players start promptly.
        burst = BYTES_PER_SECOND * 2
        try:
            while True:
                current, _ = self.scenario.get()
                if current == "down":
                    return
                if current == "silent":  # connection stays open, no bytes
                    time.sleep(0.25)
                    continue
                size = burst or chunk
                burst = 0
                out = b""
                while len(out) < size:
                    take = audio[pos : pos + (size - len(out))]
                    out += take
                    pos = (pos + len(take)) % len(audio)
                self.wfile.write(out)
                self.wfile.flush()
                time.sleep(size / BYTES_PER_SECOND)
        except (BrokenPipeError, ConnectionResetError):
            return


class NowPlayingHandler(Base):
    label = "nowplaying"
    rotate_seconds = 90

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, HEAD")
        self.end_headers()

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        if self.handle_control():
            return
        name, since = self.scenario.get()
        headers = {"Access-Control-Allow-Origin": "*", "Cache-Control": "max-age=0"}
        ctype = "binary/octet-stream"  # what S3 actually returns today
        if name == "error":
            self.send_text(500, "<Error><Code>InternalError</Code></Error>", "application/xml", headers)
            return
        if name == "malformed":
            self.send_text(200, '{"nowplaying": {"ARTIST": "Miri', ctype, headers)
            return
        if name == "slow":
            time.sleep(12)

        now = time.time()
        if name == "stale":
            index, changed = 0, now - 2 * 3600
        else:
            index = int((now - since) // self.rotate_seconds)
            changed = since + index * self.rotate_seconds
        title, artist = TRACKS[index % len(TRACKS)]

        if name == "null":
            np = {"ARTIST": None, "TITLE": None}
        elif name == "Null":  # what the feed reports when a DJ streams from a laptop
            np = {"ARTIST": "Null", "TITLE": "Null"}
        elif name == "empty":
            np = {"ARTIST": "", "TITLE": ""}
        elif name == "title-only":
            np = {"ARTIST": "", "TITLE": title}
        elif name == "urlencoded":
            np = {"ARTIST": urllib.parse.quote_plus(artist), "TITLE": urllib.parse.quote_plus(title)}
        else:  # rotating, stale, slow
            np = {"ARTIST": artist, "TITLE": title}

        headers["Last-Modified"] = format_datetime(datetime.fromtimestamp(changed, timezone.utc), usegmt=True)
        headers["ETag"] = f'"{int(changed)}-{name}"'
        self.send_text(200, json.dumps({"nowplaying": np}), ctype, headers)


class CalendarHandler(Base):
    label = "calendar"
    demo_minutes = 2

    def do_GET(self):
        if self.handle_control():
            return
        name, since = self.scenario.get()
        if name == "error":
            self.send_text(500, "calendar unavailable")
            return
        if name == "malformed":
            self.send_text(200, "BEGIN:VCALENDAR\r\nGARBAGE\r\n<html>", "text/calendar; charset=UTF-8")
            return
        # demo-now is anchored to when the scenario was selected, so repeated
        # fetches describe the same occurrence.
        now = datetime.fromtimestamp(since).astimezone(calendar_fixture.ET) if name == "demo-now" else None
        text = calendar_fixture.build(name, now=now, demo_minutes=self.demo_minutes)
        self.send_text(200, text, "text/calendar; charset=UTF-8")


def serve(handler, port: int, scenario: Scenario, host: str) -> ThreadingHTTPServer:
    cls = type(handler.__name__, (handler,), {"scenario": scenario})
    httpd = ThreadingHTTPServer((host, port), cls)
    httpd.daemon_threads = True
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--stream-port", type=int, default=8801)
    p.add_argument("--nowplaying-port", type=int, default=8802)
    p.add_argument("--calendar-port", type=int, default=8803)
    p.add_argument("--mixcloud-port", type=int, default=8804)
    p.add_argument("--mixcloud-spool", default=str(Path(__file__).resolve().parents[1] / ".dev-state" / "fake-mixcloud"))
    p.add_argument("--stream", default="ok", help="ok | silent | down")
    p.add_argument("--nowplaying", default="rotating")
    p.add_argument("--calendar", default="snapshot")
    p.add_argument("--rotate-seconds", type=int, default=90)
    p.add_argument("--demo-minutes", type=int, default=2)
    args = p.parse_args()

    NowPlayingHandler.rotate_seconds = args.rotate_seconds
    CalendarHandler.demo_minutes = args.demo_minutes
    np_choices = ("rotating", "urlencoded", "null", "Null", "empty", "title-only", "stale", "error", "malformed", "slow")
    cal_choices = calendar_fixture.SCENARIOS + ("error", "malformed")

    serve(StreamHandler, args.stream_port, Scenario(args.stream, ("ok", "silent", "down")), args.host)
    serve(NowPlayingHandler, args.nowplaying_port, Scenario(args.nowplaying, np_choices), args.host)
    serve(CalendarHandler, args.calendar_port, Scenario(args.calendar, cal_choices), args.host)
    mixcloud = type("FakeMixcloud", (fake_mixcloud.FakeMixcloudHandler,), {"store": fake_mixcloud.Store(Path(args.mixcloud_spool))})
    httpd = ThreadingHTTPServer((args.host, args.mixcloud_port), mixcloud)
    httpd.daemon_threads = True
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    print(
        f"fake station up: stream http://{args.host}:{args.stream_port}/  "
        f"nowplaying http://{args.host}:{args.nowplaying_port}/  "
        f"calendar http://{args.host}:{args.calendar_port}/basic.ics  "
        f"mixcloud http://{args.host}:{args.mixcloud_port}/",
        flush=True,
    )
    try:
        while True:
            time.sleep(3600)
    except KeyboardInterrupt:
        return 0


if __name__ == "__main__":
    sys.exit(main())
