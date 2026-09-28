# WJRH backend (local)

The application layer that the new frontend design assumes. It runs entirely on your machine
against a **fake station**, so you can build and test the backend before the board settles hosting,
budget or archive licensing.

> **Status: local only, not deployed.** The architecture decisions are in
> [`docs/backend/decisions/`](../docs/backend/decisions/):
> - ADR-001: platform and cost.
> - ADR-002: archive and licensing.
>
> The API follows [`docs/backend/API_CONTRACTS.md`](../docs/backend/API_CONTRACTS.md).

```
             fake station (mocks/)                     API (api/, Cloudflare Worker)                clients
  ┌──────────────────────────────────┐        ┌────────────────────────────────────┐
  │ :8801 stream   MP3, ICY, no CORS │◄─probe─┤ health        /v1/health            │
  │ :8802 nowplaying ARTIST/TITLE    │◄─poll──┤ collector ──► /v1/now-playing      │◄── PWA (wjrh-app/?api=…)
  │ :8803 calendar  Google-style ICS │◄─fetch─┤ schedule  ──► /v1/schedule{,/weekly}│
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

You need Node 20+ and Python 3.10+. Docker is optional.

```bash
backend/scripts/dev.sh                 # starts everything; Ctrl-C stops it
python3 backend/scripts/e2e.py         # in another terminal: full end-to-end check (~4 min)
python3 backend/scripts/e2e.py --quick # everything except the archive recording
```

Then open:

| URL | What |
|---|---|
| http://127.0.0.1:8765/?api=http://127.0.0.1:8787 | The production PWA reading from the local API (`?api=off` switches back) |
| http://127.0.0.1:8787/v1/health | API health |
| http://127.0.0.1:8790/archive-player.html | Archive test bench: play/seek episodes, work the review queue |

`dev.sh` does the following:
- creates `backend/.dev-state/` (venv, local D1, logs; git-ignored);
- starts the fake station and an S3 emulator (moto; `S3_BACKEND=minio` uses Docker instead);
- applies migrations and runs `wrangler dev`;
- serves the PWA;
- ticks the cron jobs every 1, 5 and 15 minutes.

Add `--with-recorder` to also run the archive recorder for every show.

## Unit and contract tests

```bash
cd backend/api && npm ci && npm test      # 47 tests, run inside workerd; no network needed
npm run typecheck
```

What the tests cover:
- Every endpoint is validated against the JSON Schemas in [`schemas/`](schemas/).
- Calendar recurrence edge cases: EXDATE, RECURRENCE-ID moves and cancellations, UNTIL, COUNT,
  INTERVAL, and the end of daylight saving time.
- `/v1/schedule/weekly` must reproduce today's `wjrh-app/schedule.json` **byte for byte**. That makes
  it a drop-in replacement for `fetch_schedule.py`.
- Metadata:
  - `Null` or URL-encoded values;
  - feed outages served as stale;
  - collector de-duplication, including a metadata blip in the middle of a track.
- Health:
  - the stream probe fails when HTTP 200 arrives with no audio;
  - calendar shows with no profile are reported.
- Join validation, per-client rate limits, and no raw IPs stored.
- The whole archive workflow: auth, state machine, storage verification, audit log, retention.

## Layout

| Path | What |
|---|---|
| `api/src/index.ts` | Routes, CORS, admin auth, the cron dispatch table |
| `api/src/ics.ts` | Calendar parser. Port of `fetch_schedule.py`, plus dated recurrence expansion |
| `api/src/schedule.ts` | Refresh with validation, last-known-good snapshots, occurrences, legacy weekly shape |
| `api/src/nowplaying.ts` | Feed normalization (port of the PWA's `cleanMeta`) and the play-history collector |
| `api/src/health.ts` | Probes (reads real audio bytes) and the `/v1/health` report |
| `api/src/archives.ts`, `storage.ts` | Episode workflow; S3-compatible storage adapter (R2, MinIO, AWS) |
| `api/src/join.ts` | Join adapter. Only a dev `log` provider exists; the real provider is undecided |
| `api/migrations/` | D1 schema |
| `content/shows.json` | **Station-owned** show profiles, keyed by the slugs in `docs/content/STATION_CONTENT_BRIEF.md`. Fill in genres, blurbs and bios here |
| `content/station.json` | Team roster and events (moved out of the prototype). `approved: false` until the station confirms |
| `schemas/` | JSON Schema for every `/v1` response |
| `mocks/fake_station.py` | Fake stream, now-playing and calendar, with runtime failure scenarios |
| `mocks/calendar_fixture.py` | Builds the ICS fixtures (see the note on fixtures below) |
| `recorder/recorder.py` | Archive recorder. Standard-library Python, runs on a booth PC or Pi |
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
- `mocks/fixtures/calendar-snapshot.ics` is therefore **reconstructed** from the committed
  `schedule.json`. It round-trips exactly through `fetch_schedule.py`.
- The now-playing payload shape (`{"nowplaying": {"ARTIST", "TITLE"}}`, served as
  `binary/octet-stream`) comes from the PWA code and `tools/verify_backend.py`.

When you have network access, capture the real ones and rerun the tests:

```bash
curl -o backend/mocks/fixtures/calendar-snapshot.ics "<ICS URL from tools/verify_backend.py>"
curl -sD - https://nowplaying.wjrh.org      # compare with mocks/fake_station.py
```

`python3 tools/verify_backend.py --local` runs the production verifier against the mocks.

## Pointing the PWA at the API

`wjrh-app/app.js` has a `CONFIG.apiBase` that is **empty by default**. When it is empty, the app behaves
exactly as before; that is checked with `wjrh-app/tools/verify-ui.cjs`.

When `apiBase` is set, or `?api=` is passed:
- now-playing comes from `/v1/now-playing`;
- the schedule comes from `/v1/schedule/weekly`, in the same shape as `schedule.json`;
- "Last heard" becomes **station-wide** history from `/v1/recent`. If that fails it falls back to the
  device log, and the label says which source is showing;
- the interest form posts to `/v1/join`.

The service worker never caches `/v1/*`.

The design prototype (`claude-design-preview/`) is not wired up. Its Archive screen reads fixture
constants (`ARCHIVE_SHOWS`, `PROOF_ARCHIVE_DATES`, `LOG_LIVE`) and fakes playback with a timer. The
frontend follow-up is to port it into the PWA and make three changes:
- replace those constants with `/v1/archives`, `/v1/shows/{id}/archives` and `/v1/recent`;
- replace the timer with a real `<audio>` element, as `devtools/archive-player.html` does;
- replace `TEAM` and `EVENTS` with `/v1/station`.

## Not done yet

- Production deployment: Cloudflare account, DNS, secrets, Cloudflare Access for `/v1/admin/*`.
  See ADR-001.
- Alerting. `/v1/health` reports problems, but nobody is paged.
- A real join provider (Mailman, a form service…) and push reminders (deferred, P3).
- Porting the prototype's Archive and Station screens into the PWA.
- Artwork. `artwork` stays `null` until the station supplies rights-cleared images.
