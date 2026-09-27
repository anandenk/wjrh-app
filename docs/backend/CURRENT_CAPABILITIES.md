# Current capabilities

Verified against the public services and local source on **2026-09-25 ET**
(2026-09-26 UTC). Run `python3 tools/verify_backend.py` to refresh the checks.

## Scope and confidence

This document describes what can be established from:

- the public WJRH stream;
- the public now-playing endpoint;
- the public Google Calendar ICS feed;
- the production-oriented static PWA in `wjrh-app/`; and
- the visual prototype in `claude-design-preview/`.

This workspace does **not** contain source code, infrastructure configuration, logs,
credentials, or deployment access for the stream server, metadata publisher,
S3/CloudFront distribution, or a general WJRH application backend. Those systems must
be discovered with their current owners before implementation begins.

## Existing system

```text
DJ / automation
  ├─ audio ───────────────> Shoutcast / ProStream ─────> listener audio element
  └─ track metadata ──────> S3 + CloudFront JSON ──────> browser polling every 15 s

Public Google Calendar ───> fetch_schedule.py ─────────> static schedule.json

Static app files ─────────> web host / service worker ─> installed or browser PWA
```

There is no station application API, database, archive service, persistent play-history
service, push service, or content-management service represented in this workspace.

## Public service verification

| Service | Verified result | Supported now | Important limits |
|---|---|---|---|
| Live audio | `200 OK`, `audio/mpeg`, Shoutcast ICY, ProStream, 128 kbps, HTTPS | Continuous live listening through a plain `<audio>` element | No observed stream CORS header; do not require CORS or use Web Audio without infrastructure changes |
| Now playing | `200 OK`, CORS `*`, JSON body | Browser-readable artist and title when the publisher supplies them | Response content type is `binary/octet-stream`; no album, artwork, played-at timestamp, show ID, history, or health status |
| Public schedule | Valid ICS, 29 `VEVENT` blocks, 26 weekly rules | Calendar-owned show names, hosts, times, durations and free-text descriptions | The app does not read ICS directly; a script must regenerate and redeploy `schedule.json` |

The first verification request returned null artist/title values; a repeat request a few
minutes later returned both populated. That confirms the endpoint is live and also
demonstrates why the client must retain an explicit missing-metadata state. The client
already treats null/`Null` values as missing metadata.

## Schedule snapshot status

The committed `wjrh-app/schedule.json` was generated on
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

## What the production-oriented PWA can do

The implementation in `wjrh-app/` currently supports:

- play and pause of the live MP3 stream;
- buffering, reconnecting, stream-down and offline states;
- polling now-playing metadata every 15 seconds while active;
- title and artist display, with an album field ready if the feed adds one;
- a three-hour, device-local track log built from metadata observed while the app is
  open;
- a weekly schedule loaded from static `schedule.json`;
- current-show and next-show calculations in `America/New_York`;
- show detail when editorial fields exist;
- device-local saved shows and browser notifications while the app remains open;
- Media Session metadata and play/pause/stop handlers;
- an installable PWA manifest and service-worker shell caching;
- an offline schedule fallback from the service-worker cache;
- a host-interest form that validates and stores an email locally, with a manual
  email fallback because no submission endpoint is configured; and
- direct station telephone, website, Instagram, and giving links.

## What the production-oriented PWA cannot do

- It cannot provide a station-wide or cross-device listening history.
- It cannot display album names reliably because the feed does not provide them.
- It cannot provide real album or show artwork from metadata.
- It cannot show per-show playlists from previous broadcasts.
- It cannot send scheduled reminders after the web app has been closed.
- It cannot subscribe a listener to an interest list without a configured endpoint.
- It cannot list, stream, seek, publish, or remove archived broadcasts.
- It cannot let station staff edit show profiles independently of code/calendar text.
- It has no monitoring, administrative UI, authentication, analytics, or audit log.

## What exists only in the visual prototype

`claude-design-preview/WJRH Radio.dc.html` demonstrates, but does not implement against
production services:

- an Archive tab with one page per show;
- three sample broadcast dates per show;
- on-demand play/pause, 30-second skip, seeking and persistent archive progress;
- album-cover artwork used as show/episode imagery;
- generated show descriptions;
- a fabricated recent-track log and playback state;
- a fixed demonstration clock and broadcast state; and
- expanded Station pages and imagery.

The prototype code explicitly marks archive dates, recordings, descriptions, recent
tracks and album covers as fixtures or placeholders. They must not be presented as
production data.

## Data ownership today

| Data | Current owner/source | Update path |
|---|---|---|
| Audio | Lafayette-hosted Shoutcast/ProStream | Encoder and stream operations |
| Artist/title | Existing metadata publisher to S3/CloudFront | Encoder/automation metadata workflow |
| Schedule | Public Google Calendar | Run `wjrh-app/tools/fetch_schedule.py`, review diff, redeploy |
| Genre/description | Calendar description text | Same schedule refresh; data quality is inconsistent |
| Host bios | None | New editorial source required |
| Recent spins | Each listener device | New server-side collector required |
| Archive episodes | None | New recording, storage, metadata and publishing workflow required |
| Show artwork | None | Station-approved asset source required |
| Reminders | Each listener device while app is open | Push or native notification service required for reliable delivery |
| Host-interest submissions | Local storage plus manual email | Submission integration required |

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
