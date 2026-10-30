# WJRH listener app

> **Independent design and engineering prototype. Not officially approved, commissioned, or endorsed by WJRH or Lafayette College.**

A listener app for WJRH 104.9 FM (Lafayette College): the native iOS/Android app, the `/v1` API it reads, and the
HTML design it follows. It is a proposal to the station: nothing here is the station's own service yet.

**Current state, verified behavior, pending checks and next steps:** [`docs/mobile-app/status.md`](docs/mobile-app/status.md).
Keep changing progress there so this overview and new sessions do not carry competing versions of the handoff.

**Working on the project:** start with [`AGENTS.md`](AGENTS.md), shared by Claude Code and Codex.
[`docs/workflow.md`](docs/workflow.md) explains the task/PR workflow and which document owns each kind of information.

## What's here

| Path | What it is |
|---|---|
| `apps/mobile/` | The native listener app (Expo SDK 57, React Native, Expo Router). Layout, scripts and env vars: its [README](apps/mobile/README.md) |
| `backend/` | The `/v1` API (a Cloudflare Worker + D1), the archive recorder, JSON schemas, and a fake station + fake Mixcloud to run against. See [`backend/README.md`](backend/README.md) and [`backend/TESTING.md`](backend/TESTING.md) |
| `backend/schemas/` | The source of truth for API response shapes; the app's types are generated from them |
| `frontend/` | The visual design (`index.html`, on built-in demo data). The app follows it |
| `docs/mobile-app/` | The app's docs, below |
| `docs/backend-proposal/` | What the station runs today, the gaps, the API, the rollout plan, decisions, and the demo deployment |
| `docs/station-content-brief.md` | Show genres, blurbs and host bios the station needs to supply |
| `docs/deploying-the-frontend.md` | How to put `frontend/` on Cloudflare Pages |
| `tools/` | Read-only checks of the real stream, feed and calendar; the real schedule snapshot; `design-compare/` (screenshots the app next to the design) |

### The app's docs (`docs/mobile-app/`)

- [`status.md`](docs/mobile-app/status.md): current state, verified vs not, decisions waiting on people, how to run, gotchas. **Start here.**
- [`plan.md`](docs/mobile-app/plan.md): stack, screen-to-endpoint map, rules, build order.
- [`iphone-test-checklist.md`](docs/mobile-app/iphone-test-checklist.md): what still needs a real phone, and how to build onto one.
- [`archive-demo.md`](docs/mobile-app/archive-demo.md): the Archive demo for the board, what in it is made up, and how to build it onto a phone.
- [`design-polish.md`](docs/mobile-app/design-polish.md): how the app was matched to the design, and where it differs on purpose.
- [`audio-spike.md`](docs/mobile-app/audio-spike.md), [`phase0-findings.md`](docs/mobile-app/phase0-findings.md): why `expo-audio`, and what running against the real station showed.

### Backend proposal, in reading order

1. [`current-systems.md`](docs/backend-proposal/current-systems.md): what the station runs today, and the licensing rules
2. [`gaps.md`](docs/backend-proposal/gaps.md): what the design needs that doesn't exist
3. [`api.md`](docs/backend-proposal/api.md): the `/v1` API, screen by screen
4. [`rollout-plan.md`](docs/backend-proposal/rollout-plan.md): rollout phases
5. [`decisions/`](docs/backend-proposal/decisions/): [001 hosting on Cloudflare](docs/backend-proposal/decisions/001-hosting-on-cloudflare.md), [002 archive and licensing](docs/backend-proposal/decisions/002-archive-and-licensing.md)
6. [`deployed-demo.md`](docs/backend-proposal/deployed-demo.md): the demo API on Cloudflare (address, what is public, how to redeploy)

## Run the backend locally

Free: no Cloudflare or Mixcloud account needed. Use Node 24 (also used in CI) and Python 3.10+.

```bash
(cd backend/api && npm ci && npm test)    # unit and contract tests in Cloudflare's runtime; npm run typecheck
backend/scripts/dev.sh                    # fake station + fake Mixcloud + API on http://127.0.0.1:8787
python3 backend/scripts/e2e.py --quick    # in another terminal: end-to-end check against dev.sh
backend/scripts/dev-real.sh               # or: the API on :8797 against the REAL station (read-only)
```

## Run the app

```bash
backend/scripts/dev.sh                     # the API the app talks to, on :8787
cd apps/mobile && npm ci
npm run typecheck && npm test && npm run check:contract && npm run lint   # must all pass
APP_VARIANT=development npx expo run:ios   # builds a development app for the iOS simulator and starts Metro
```

Needs a Mac with Xcode 27 (its simulator app is `DeviceHub`, not `Simulator`). The Android emulator, the dev-only test
hooks and the gotchas are in [`status.md`](docs/mobile-app/status.md). **On a real iPhone:**
`apps/mobile/scripts/build-phone.sh` builds a signed Release app and installs it on a connected iPhone (its header lists
the settings). Pointed at the demo API, the phone then needs no Mac; a free Apple account's build stops opening after 7 days. See [`archive-demo.md`](docs/mobile-app/archive-demo.md) and
[`iphone-test-checklist.md`](docs/mobile-app/iphone-test-checklist.md). Never expose the local API (`API_HOST=0.0.0.0`)
on campus Wi-Fi; use the demo API or a phone hotspot.

## Preview the design

```bash
python3 -m http.server 8765 --bind 127.0.0.1 --directory frontend
```

Open <http://127.0.0.1:8765/>. It loads React from unpkg.com, so it needs internet access.

## Check the real services

```bash
python3 tools/check_station_services.py   # stream, now-playing feed, calendar, schedule drift
python3 tools/fetch_schedule.py           # refresh tools/schedule-snapshot.json from the calendar
```

Both are read-only against WJRH's services.

## Boundaries

- **Licensing (webcasting, 17 U.S.C. §114):** never publish upcoming songs or add per-track playback, a queue, or
  recording of the live stream. Every Play reconnects live, so a pause is never a rewind. Details in
  [`current-systems.md`](docs/backend-proposal/current-systems.md).
- Live audio plays straight from the stream URL, never through the API. Mixcloud archives would play only in
  Mixcloud's own player.
- The student roster (names, emails) stays hidden until the station approves it: the API sends `team: []` while
  `/v1/station` says `approved: false`.
- The HTML design always uses demo tracks, archives and covers. The app's labelled Archive demo is off by default
  (`EXPO_PUBLIC_DEMO_ARCHIVES=1`). The app demo shows real album covers loaded from Apple at run time: **private pitch
  only**; remove them before any public release ([`archive-demo.md`](docs/mobile-app/archive-demo.md)).
