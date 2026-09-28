"""
Fake Mixcloud: a local stand-in for the parts of Mixcloud the archive uses.

Served by fake_station.py on :8804. Nothing here talks to the real Mixcloud, so
the whole Mixcloud archive path (record → upload → register → review → play)
runs locally without an account, an app registration or a Pro plan.

  POST /upload/?access_token=…   multipart upload, like api.mixcloud.com/upload/
                                 fields: mp3, name, description, tags-N-tag,
                                 sections-N-artist / -song / -start_time, unlisted
  GET  /<account>/<slug>/        cloudcast JSON, like api.mixcloud.com/<key>
  GET  /<account>/cloudcasts/    the account's uploads
  GET  /widget/iframe/?feed=KEY  a plain stand-in for Mixcloud's embedded player
  GET  /_media/<account>/<slug>.mp3   audio for the stand-in player (Range supported)

Like the free tier, an account holds at most FREE_TIER_SHOWS shows; the next
upload is refused. The shapes follow Mixcloud's public API documentation as far
as it is known here; check them against the real API before production.
"""

from __future__ import annotations

import html
import json
import re
import threading
import time
import urllib.parse
from email.parser import BytesParser
from email.policy import HTTP
from http.server import BaseHTTPRequestHandler
from pathlib import Path

ACCOUNT = "wjrh"
TOKEN = "dev-mixcloud-token"
FREE_TIER_SHOWS = 10
BYTES_PER_SECOND = 128_000 // 8


class Store:
    def __init__(self, spool: Path):
        self.spool = spool
        self.lock = threading.Lock()
        self.casts: dict[str, dict] = {}

    def slug_for(self, name: str) -> str:
        base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:60] or "show"
        slug, n = base, 2
        while f"/{ACCOUNT}/{slug}/" in self.casts:
            slug, n = f"{base}-{n}", n + 1
        return slug

    def add(self, fields: dict[str, list], audio: bytes) -> dict:
        with self.lock:
            if len(self.casts) >= FREE_TIER_SHOWS:
                raise LimitError()
            name = fields["name"][0]
            slug = self.slug_for(name)
            key = f"/{ACCOUNT}/{slug}/"
            self.spool.mkdir(parents=True, exist_ok=True)
            (self.spool / f"{slug}.mp3").write_bytes(audio)
            sections = []
            i = 0
            while f"sections-{i}-song" in fields or f"sections-{i}-artist" in fields:
                sections.append({
                    "artist": fields.get(f"sections-{i}-artist", [""])[0],
                    "song": fields.get(f"sections-{i}-song", [""])[0],
                    "start_time": int(fields.get(f"sections-{i}-start_time", ["0"])[0] or 0),
                })
                i += 1
            cast = {
                "key": key,
                "url": f"https://www.mixcloud.com{key}",
                "name": name,
                "slug": slug,
                "description": fields.get("description", [""])[0],
                "tags": [{"name": v[0]} for k, v in sorted(fields.items()) if re.fullmatch(r"tags-\d+-tag", k)],
                "sections": sections,
                "unlisted": fields.get("unlisted", ["0"])[0] == "1",
                "audio_length": max(1, round(len(audio) / BYTES_PER_SECOND)),
                "created_time": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "user": {"username": ACCOUNT, "key": f"/{ACCOUNT}/"},
            }
            self.casts[key] = cast
            return cast


class LimitError(Exception):
    pass


class FakeMixcloudHandler(BaseHTTPRequestHandler):
    store: Store
    server_version = "FakeMixcloud/1.0"
    label = "mixcloud"

    def log_message(self, fmt, *args):
        import sys

        sys.stderr.write(f"[{self.label}] {fmt % args}\n")

    def send_json(self, code: int, body: dict) -> None:
        data = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path != "/upload/":
            return self.send_json(404, {"error": {"type": "NotFound"}})
        token = urllib.parse.parse_qs(parsed.query).get("access_token", [""])[0]
        if token != TOKEN:
            return self.send_json(401, {"error": {"type": "OAuthException", "message": "Invalid access token"}})
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length)
        msg = BytesParser(policy=HTTP).parsebytes(
            f"Content-Type: {self.headers.get('Content-Type', '')}\r\n\r\n".encode() + raw
        )
        fields: dict[str, list] = {}
        audio = b""
        for part in msg.iter_parts() if msg.is_multipart() else []:
            name = part.get_param("name", header="content-disposition")
            payload = part.get_payload(decode=True) or b""
            if name == "mp3":
                audio = payload
            elif name:
                fields.setdefault(name, []).append(payload.decode("utf-8", "replace"))
        if not audio or not fields.get("name", [""])[0].strip():
            return self.send_json(400, {"error": {"type": "UploadError", "message": "mp3 and name are required"}})
        try:
            cast = self.store.add(fields, audio)
        except LimitError:
            return self.send_json(403, {"error": {"type": "UploadLimitError",
                                                  "message": f"Free accounts can publish {FREE_TIER_SHOWS} shows (mock)"}})
        self.send_json(200, {"result": {"success": True, "message": "Uploaded", "key": cast["key"]}})

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        if path == "/widget/iframe/":
            return self.widget(urllib.parse.parse_qs(parsed.query).get("feed", [""])[0])
        m = re.fullmatch(r"/_media/([A-Za-z0-9_-]+)/([A-Za-z0-9_-]+)\.mp3", path)
        if m:
            return self.media(m.group(2))
        m = re.fullmatch(r"/([A-Za-z0-9_-]+)/cloudcasts/", path)
        if m:
            with self.store.lock:
                data = [c for c in self.store.casts.values() if c["user"]["username"] == m.group(1)]
            return self.send_json(200, {"data": data})
        with self.store.lock:
            cast = self.store.casts.get(path)
        if cast:
            return self.send_json(200, cast)
        self.send_json(404, {"error": {"type": "NotFound"}})

    def media(self, slug: str) -> None:
        f = self.store.spool / f"{slug}.mp3"
        if not f.exists():
            return self.send_json(404, {"error": {"type": "NotFound"}})
        data = f.read_bytes()
        start, end = 0, len(data) - 1
        rng = re.fullmatch(r"bytes=(\d*)-(\d*)", self.headers.get("Range", ""))
        if rng and (rng.group(1) or rng.group(2)):
            if rng.group(1):
                start = int(rng.group(1))
                end = int(rng.group(2)) if rng.group(2) else end
            else:
                start = max(0, len(data) - int(rng.group(2)))
            end = min(end, len(data) - 1)
            self.send_response(206)
            self.send_header("Content-Range", f"bytes {start}-{end}/{len(data)}")
        else:
            self.send_response(200)
        self.send_header("Content-Type", "audio/mpeg")
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(end - start + 1))
        self.end_headers()
        self.wfile.write(data[start : end + 1])

    def widget(self, feed: str) -> None:
        with self.store.lock:
            cast = self.store.casts.get(feed)
        if not cast:
            body = f"<p>No upload at {html.escape(feed)}</p>"
        else:
            src = f"/_media/{cast['user']['username']}/{cast['slug']}.mp3"
            body = (
                f"<div class=tag>Local stand-in for the Mixcloud player</div>"
                f"<div class=name>{html.escape(cast['name'])}</div>"
                f"<audio controls preload=metadata src='{src}'></audio>"
            )
        page = f"""<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'>
<style>body{{margin:0;font:14px system-ui;background:#fff;color:#1a1a1a;padding:10px 12px}}
.tag{{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#5000ff}}
.name{{font-weight:600;margin:4px 0 8px}}audio{{width:100%}}</style>{body}"""
        data = page.encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)
