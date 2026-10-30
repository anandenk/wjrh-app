# Current capabilities

Verified against the public services and local source on **2026-09-25 ET**
(2026-09-26 UTC). Run `python3 tools/check_station_services.py` to refresh the checks.

## Scope and confidence

This document describes what can be established from:

- the public WJRH stream;
- the public now-playing endpoint;
- the public Google Calendar ICS feed;
- the schedule snapshot tools in `tools/`; and
- the frontend design in `frontend/`.

This workspace does **not** contain source code, infrastructure configuration, logs,
credentials, or deployment access for the stream server, metadata publisher,
S3/CloudFront distribution, or a general WJRH application backend. Those systems must
be discovered with their current owners before implementation begins.

## Existing system

```text
DJ / automation
  ├─ audio ───────────────> Shoutcast / ProStream ─────> listeners' players
  └─ track metadata ──────> S3 + CloudFront JSON ──────> clients polling for artist/title

Public Google Calendar ───> tools/fetch_schedule.py ───> tools/schedule-snapshot.json (run by hand)
```

There is no station application API, database, archive service, persistent play-history
service, push service, or content-management service represented in this workspace.

## Public service verification

| Service | Verified result | Supported now | Important limits |
|---|---|---|---|
| Live audio | `200 OK`, `audio/mpeg`, Shoutcast ICY, ProStream, 128 kbps, HTTPS | Continuous live listening through a plain `<audio>` element | No observed stream CORS header; do not require CORS or use Web Audio without infrastructure changes |
| Now playing | `200 OK`, CORS `*`, JSON body | Browser-readable artist and title when the publisher supplies them | Response content type is `binary/octet-stream`; no album, artwork, played-at timestamp, show ID, history, or health status |
| Public schedule | Valid ICS, 29 `VEVENT` blocks, 26 weekly rules | Calendar-owned show names, hosts, times, durations and free-text descriptions | The app does not read ICS directly; a script must regenerate and redeploy `tools/schedule-snapshot.json` |

The first verification request returned null artist/title values; a repeat request a few
minutes later returned both populated. That confirms the endpoint is live and also
demonstrates why the client must retain an explicit missing-metadata state. The client
already treats null/`Null` values as missing metadata.

## Schedule snapshot status

The committed `tools/schedule-snapshot.json` was generated on
`2026-09-18T23:04:03-04:00`.

| Measure | Committed snapshot | Current live calendar after normalization |
|---|---:|---:|
| Slots | 28 | 27 |
| Unique shows | 27 | 27 |
| Blank genres | 19 | 19 |
| Blank descriptions | 19 | 19 |
| Blank host bios | 28 | 27 |

Detected schedule drift:

- The committed snapshot still has a Friday 5:00 PM `API on Air` slot that is no
  longer in the live calendar.
- `The Bit` is one hour in the snapshot but two hours in the live calendar.

This demonstrates that schedule refresh is functional but manual and currently stale.

## The frontend design

`frontend/index.html` (also what deploys to Cloudflare Pages)
runs entirely on built-in demo data. It demonstrates, but does not implement against
production services:

- an Archive tab with one page per show;
- three sample broadcast dates per show;
- on-demand play/pause, 30-second skip, seeking and persistent archive progress;
- album-cover artwork used as show/episode imagery;
- generated show descriptions;
- a fabricated recent-track log and simulated playback, including the live play button;
- a fixed demonstration clock and broadcast state; and
- expanded Station pages and imagery.

The prototype code explicitly marks archive dates, recordings, descriptions, recent
tracks and album covers as fixtures or placeholders. They must not be presented as
production data. What would replace each fixture is mapped in
[`api.md`](api.md).

An earlier listener PWA (`wjrh-app/`) was connected to the real stream, feed and schedule
snapshot. It was removed from the repository to keep the focus on the current design; it
remains in git history (commit `6f00888`).

## Data ownership today

| Data | Current owner/source | Update path |
|---|---|---|
| Audio | Lafayette-hosted Shoutcast/ProStream | Encoder and stream operations |
| Artist/title | Existing metadata publisher to S3/CloudFront | Encoder/automation metadata workflow |
| Schedule | Public Google Calendar | Run `tools/fetch_schedule.py` and review the diff |
| Genre/description | Calendar description text | Same schedule refresh; data quality is inconsistent |
| Host bios | None | New editorial source required |
| Recent spins | None | New server-side collector required |
| Archive episodes | None | New recording, storage, metadata and publishing workflow required |
| Show artwork | None | Station-approved asset source required |
| Reminders | None | Push or native notification service required |
| Host-interest submissions | GroupMe and email links | Submission integration only if a form is wanted |

## Licensing rules for any frontend

The stream runs under the Section 114 statutory webcasting licence. Any app built on it
must:

- **never show an advance playlist**. Upcoming *shows* are fine; upcoming songs, artists
  or albums are not;
- **display title, artist and album** while a track plays. The feed has no album today;
  that gap has to be fixed at the encoder;
- **stay non-interactive**: no queue, no song picking, no per-track replay, and nothing
  that helps a listener record the stream.

## Immediate operational risks

1. **Metadata completeness:** album is unavailable, while the current app notes it as
   a statutory webcasting display requirement.
2. **Schedule freshness:** the committed schedule has already drifted from the live
   calendar.
3. **Prototype confusion:** the most polished artifact contains non-production archive
   and track data.
4. **No service ownership record:** backend code, credentials, monitoring and incident
   contacts are not present here.
5. **No archive policy:** recording retention, publishing approval and licensing have
   not been defined.
