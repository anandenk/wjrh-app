# WJRH backend (local)

The application layer that the new frontend design assumes. It runs entirely on your machine
against a **fake station**, so you can build and test the backend before the board settles hosting,
budget or archive licensing.
The native app in [`../apps/mobile/`](../apps/mobile/) already consumes this API; the HTML design remains a demo.

> **Status: local, plus a demo copy on Cloudflare's free plan** ([`deployed-demo.md`](../docs/backend-proposal/deployed-demo.md)); not the station's production. The architecture decisions are in
> [`docs/backend-proposal/decisions/`](../docs/backend-proposal/decisions/):
> - 001: hosting on Cloudflare, and cost.
> - 002: archive and licensing (Mixcloud or whole-day blocks).
>
> The API follows [`docs/backend-proposal/api.md`](../docs/backend-proposal/api.md).

```
             fake station (mocks/)                     API (api/, Cloudflare Worker)                clients
  ┌──────────────────────────────────┐        ┌────────────────────────────────────┐
  │ :8801 stream   MP3, ICY, no CORS │◄─probe─┤ health        /v1/health            │
  │ :8802 nowplaying ARTIST/TITLE    │◄─poll──┤ collector ──► /v1/now-playing      │◄── listener app
  │ :8803 calendar  Google-style ICS │◄─fetch─┤ schedule  ──► /v1/schedule{,/weekly}│
  │ :8804 Mixcloud  upload + player  │◄─check─┤                                    │
  └──────────────────────────────────┘        │ content   ──► /v1/shows, /v1/station│◄── archive test bench
                 ▲ records                    │ join      ──► /v1/join              │    (devtools/)
  ┌──────────────┴───────────┐  register/PATCH│ archives  ──► /v1/archives, …       │
  │ recorder/ (always-on box)│───────────────►│ admin     ──► /v1/admin/*  (token)  │
  └──────────────┬───────────┘                └──────────────┬─────────────────────┘
                 │ presigned PUT                              │ D1 (SQLite)
                 ▼                                            │
  ┌──────────────────────────┐   audioUrl (Range) ◄───────────┘
  │ :9000 S3 (moto / MinIO)  │─────────────────────────────────────────────────────────► listeners
  └──────────────────────────┘
```

## Quick start

**Step-by-step walkthrough, including breaking things on purpose:** [`TESTING.md`](TESTING.md).

Use Node 24 (also used in CI) and Python 3.10+. Docker is optional.

```bash
backend/scripts/dev.sh                 # starts everything; Ctrl-C stops it
python3 backend/scripts/e2e.py         # in another terminal: full end-to-end check (~4 min)
python3 backend/scripts/e2e.py --quick # everything except the archive recording
```

Then open:

| URL | What |
|---|---|
| http://127.0.0.1:8787/v1/health | API health |
| http://127.0.0.1:8790/archive-player.html | Archive test bench: play/seek episodes, work the review queue |

`dev.sh` does the following:
- creates `backend/.dev-state/` (venv, local D1, logs; git-ignored);
- starts the fake station (including a fake Mixcloud) and an S3 emulator (moto; `S3_BACKEND=minio`
  uses Docker instead);
- applies migrations and runs `wrangler dev`;
- serves the archive test bench;
- ticks the cron jobs every 1, 5 and 15 minutes.

Add `--with-recorder` to also run the archive recorder for every show
(`WJRH_ARCHIVE_TO=mixcloud` sends recordings to the fake Mixcloud instead of S3).

## Unit and contract tests

```bash
cd backend/api && npm ci && npm test      # unit + contract tests, run inside workerd; no network needed
npm run typecheck
```

What the tests cover:
- Public response shapes are validated against the JSON Schemas in [`schemas/`](schemas/).
- Calendar recurrence edge cases: EXDATE, RECURRENCE-ID moves and cancellations, UNTIL, COUNT,
  INTERVAL, and the end of daylight saving time.
- `/v1/schedule/weekly` must reproduce the legacy snapshot format **byte for byte** (checked against
  `mocks/fixtures/schedule-snapshot.json`, the frozen snapshot that matches the fixture calendar). That makes
  it a drop-in replacement for `fetch_schedule.py`. `tools/schedule-snapshot.json` is separate: it tracks the
  real calendar and is only used for the drift check in `tools/check_station_services.py`.
- Metadata:
  - `Null` or URL-encoded values;
  - feed outages served as stale;
  - collector de-duplication, including a metadata blip in the middle of a track.
- Health:
  - the stream probe fails when HTTP 200 arrives with no audio;
  - calendar shows with no profile are reported.
- Join validation, per-client rate limits, and no raw IPs stored.
- The whole archive workflow: auth, state machine, storage verification, audit log, retention.
- Mixcloud episodes: the upload is verified on Mixcloud, the public record carries a widget URL and no
  audio URL, and deleting or expiring never touches our storage.

## Layout

| Path | What |
|---|---|
| `api/src/index.ts` | Routes, CORS, admin auth, the cron dispatch table |
| `api/src/ics.ts` | Calendar parser. Port of `fetch_schedule.py`, plus dated recurrence expansion |
| `api/src/schedule.ts` | Refresh with validation, last-known-good snapshots, occurrences, legacy weekly shape |
| `api/src/nowplaying.ts` | Feed normalization (port of the PWA's `cleanMeta`) and the play-history collector |
| `api/src/health.ts` | Probes (reads real audio bytes) and the `/v1/health` report |
| `api/src/archives.ts`, `storage.ts` | Episode workflow; S3-compatible storage adapter (R2, MinIO, AWS) |
| `api/src/mixcloud.ts` | Mixcloud as an archive provider: cloudcast lookup and widget links |
| `api/src/join.ts` | Join adapter. Only a dev `log` provider exists; the real provider is undecided |
| `api/migrations/` | D1 schema |
| `content/shows.json` | **Station-owned** show profiles, keyed by the slugs in `docs/station-content-brief.md`. Fill in genres, blurbs and bios here |
| `content/station.json` | Team roster and events (moved out of the prototype). `approved: false` until the station confirms |
| `schemas/` | JSON Schema for every `/v1` response |
| `mocks/fake_station.py` | Fake stream, now-playing and calendar, with runtime failure scenarios |
| `mocks/fake_mixcloud.py` | Fake Mixcloud: upload API, cloudcast lookup, a stand-in player, the free tier's 10-show cap |
| `mocks/calendar_fixture.py` | Builds the ICS fixtures (see the note on fixtures below) |
| `recorder/recorder.py` | Archive recorder. Standard-library Python, runs on a small cloud server. `--archive-to storage` or `mixcloud` |
| `devtools/archive-player.html` | Archive test bench |
| `scripts/dev.sh`, `scripts/e2e.py` | Local stack and end-to-end check |

## Driving the fake station

Each mock switches behaviour at runtime:

```bash
curl -X POST 'http://127.0.0.1:8802/_scenario?name=Null'   # then GET /v1/now-playing
curl http://127.0.0.1:8802/_scenario                        # current + available
```

| Mock | Scenarios |
|---|---|
| stream `:8801` | `ok`, `silent` (HTTP 200, no bytes), `down` |
| nowplaying `:8802` | `rotating` (new fictional track every 90 s), `urlencoded`, `null`, `Null`, `empty`, `title-only`, `stale` (Last-Modified 2 h ago), `error`, `malformed`, `slow` (12 s) |
| Mixcloud `:8804` | None; it keeps uploads in memory until restarted and refuses an 11th, like the free tier |
| calendar `:8803` | `snapshot`, `drift` (the real drift seen on 2026-09-25), `cancelled` (EXDATE + cancelled + moved instance next week), `empty`, `malformed`, `error`, `demo-now` (a 2-minute show starting next minute, for the recorder) |

Trigger a cron job immediately: `curl 'http://127.0.0.1:8787/__scheduled?cron=*/15+*+*+*+*'`.

The jobs are:

| Cron | Job |
|---|---|
| `* * * * *` | Collector |
| `*/5 * * * *` | Probes |
| `*/15 * * * *` | Schedule refresh |
| `17 8 * * *` | Retention |

**About the fixtures.** The sandbox that built this could not reach Google Calendar or
`nowplaying.wjrh.org`.
- `mocks/fixtures/calendar-snapshot.ics` is therefore **reconstructed** from a committed snapshot, kept
  frozen as `mocks/fixtures/schedule-snapshot.json`. It round-trips exactly through `fetch_schedule.py`.
- The now-playing payload shape (`{"nowplaying": {"ARTIST", "TITLE"}}`, served as
  `binary/octet-stream`) comes from the original PWA code and `tools/check_station_services.py`.
- The fake Mixcloud follows Mixcloud's documented API shapes as known here. Check them against the
  real API before relying on them.

Real-upstream validation was completed in PR #9 ([`phase0-findings.md`](../docs/mobile-app/phase0-findings.md)).
Keep the reconstructed calendar and its matching snapshot frozen for parity tests. To inspect a fresh capture
without replacing those fixtures:

```bash
curl -o /tmp/wjrh-calendar-live.ics "<ICS URL from tools/check_station_services.py>"
curl -sD - https://nowplaying.wjrh.org      # compare with mocks/fake_station.py
```

## Archives on Mixcloud

Decision 002 recommends Mixcloud for per-show music archives. The API supports both destinations,
chosen per episode by the recorder:

| | `--archive-to storage` | `--archive-to mixcloud` |
|---|---|---|
| Upload | Presigned `PUT` to R2/S3 | Multipart `POST` to Mixcloud's upload API, **unlisted**, with a tracklist from `/v1/recent` |
| Register | `POST /v1/admin/archives` → `uploading` → `pending_review` once the object is verified | `POST /v1/admin/archives` with `provider: "mixcloud"` and `mixcloudKey` → `pending_review` once the cloudcast is found on Mixcloud |
| Listener gets | `audioUrl` (play it in your own player, seek with Range) | `mixcloud.widgetUrl` (embed Mixcloud's player; its listening limits apply) |
| Delete | Removes the object | Removes the record; delete the upload in Mixcloud's dashboard (the audit entry says so) |
| Retention job | Deletes after `ARCHIVE_RETENTION_DAYS` | Not applied; kept until staff delete |

Staff review and publishing are identical for both.

## Connecting a frontend

The native listener app in [`../apps/mobile/`](../apps/mobile/) reads the API (PRs #12–#16); its README explains
`EXPO_PUBLIC_API_BASE`, fixtures and smoke checks. The current HTML design is not connected. Earlier wiring of
the design prototype and PWA (`?api=`) is preserved at tag `archive/api-wired-design` (commit `0a3653d`). What each
screen reads is mapped in [`../docs/mobile-app/plan.md`](../docs/mobile-app/plan.md#screen--endpoint-map).
Keep live audio direct from the stream URL in `/v1/station`, so the app still plays when the API is
down.

## Security, defaults, and runtime notes

- **Local defaults are never deployment secrets:** bearer tokens such as `test-token` in examples and test fixtures are mock defaults for local test harnesses only. Deployed environments require station-managed secrets.
- **Join log mode:** sign-up is disabled unless configured (`JOIN_PROVIDER` defaults to disabled in production vars; `dev` and `real` use `log`). When log mode is selected, submitted email addresses (along with source and timestamp) are stored in the configured D1 `join_outbox` table (the purge job deletes entries older than 30 days when it runs); no real mailing-list provider is implemented. A real, station-approved mailing-list or form provider is needed for production.
- **Archive storage links:** the API exposes direct `MEDIA_BASE_URL` audio URLs for self-hosted archives (`--archive-to storage`). Unpublishing an episode only hides it from public listings; expiring signed GET URLs are not implemented (presigning is for uploads only). Bucket object deletion, retention jobs, or storage-level delivery and access controls are required to revoke or restrict access to actual audio bytes.
- **Recorder dependencies and rights:** `recorder.py` relies solely on standard library by default, with optional `mutagen` for audio duration estimation. Real-world broadcast capture and archive distribution require operator configuration, station authorization, and applicable music rights clearance.

## Not done yet

- Production deployment: Cloudflare account, DNS, secrets, Cloudflare Access for `/v1/admin/*`.
  See decision 001.
- Alerting. `/v1/health` reports problems, but nobody is paged.
- A real join provider (Mailman, a form service…) and push reminders (deferred, P3).
- Real Archive playback in the listener app (only the sample demo exists; the backend pipeline is implemented).
- A real Mixcloud account and app registration (the free tier holds 10 shows; Pro is unlimited).
- Artwork. `artwork` stays `null` until the station supplies rights-cleared images.
