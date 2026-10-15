# WJRH listener app

WJRH 104.9 FM (Lafayette College) listener app. The owner is learning software development:
explain things plainly and briefly, and check before assuming.

**Picking this up? Read [`docs/mobile-app/status.md`](docs/mobile-app/status.md) first.** It has the current state,
what is and is not verified, decisions waiting on people, how to run everything, the gotchas, and what to do next.

## Where things are

| Path | What |
|---|---|
| `docs/mobile-app/status.md` | **Handoff: current state, next steps, how to run, gotchas.** Start here |
| `docs/mobile-app/plan.md` | The app plan: stack, screen → endpoint map, rules, build order |
| `docs/mobile-app/iphone-test-checklist.md` | Everything still untested because it needs a real phone, with the build steps and a results log |
| `apps/mobile/` | The Expo / React Native app (SDK 57, Expo Router). Now, Schedule (+ show pages, reminders) and Station tabs are built and match the design; Archive is a hidden placeholder. Its README has the layout and env vars |
| `docs/mobile-app/design-polish.md` | How the app was matched to `frontend/index.html`, where it differs on purpose, and how to re-check (`tools/design-compare/`) |
| `docs/mobile-app/audio-spike.md` | Why `expo-audio` was chosen (the spike app itself was removed; tag `archive/audio-spike`) |
| `backend/` | The `/v1` API (Cloudflare Worker + D1), recorder, JSON schemas, fake station and fake Mixcloud. Local only, except a demo copy of the API on Cloudflare's free plan ([`docs/backend-proposal/deployed-demo.md`](docs/backend-proposal/deployed-demo.md)) |
| `backend/schemas/` | Source of truth for API response shapes; the app's types are generated from these |
| `docs/backend-proposal/` | API contracts (`api.md`) and decisions: 001 Cloudflare hosting, 002 archives (Mixcloud) |
| `frontend/` | The current visual design (`index.html`). Use it as the design reference, not older copies |

The old `~/Downloads/design_handoff_wjrh_app` folder is superseded; everything in it is in git history
(commit `c526e18`). The design wired to the API is kept at tag `archive/api-wired-design`; the removed audio spike at `archive/audio-spike`.

## Commands

```bash
cd backend/api && npm ci && npm test   # 50 tests in Cloudflare's runtime; npm run typecheck
backend/scripts/dev.sh                 # fake station + fake Mixcloud + API on http://127.0.0.1:8787
backend/scripts/dev-real.sh            # API on http://127.0.0.1:8797 against the REAL station (read-only)
API_HOST=0.0.0.0 backend/scripts/dev-real.sh   # same, reachable from a phone on the same Wi-Fi
python3 backend/scripts/e2e.py --quick # end-to-end check against the running stack
python3 tools/check_station_services.py  # read-only check of the real stream, feed and calendar
cd apps/mobile && npm ci && npm run typecheck && npm test && npm run check:contract && npm run lint   # must all pass
cd apps/mobile && npm run smoke:api    # real API client vs the running dev.sh stack (smoke:fixtures: offline)
cd apps/mobile && npm run gen:types    # regenerate src/api/types.ts after backend/schemas changes
cd apps/mobile && npx expo-doctor      # must be 21/21
```

Running the app on the simulator and the dev-only env vars: see `docs/mobile-app/status.md`.

## Where we are (2026-10-02)

Plan steps 0 to 6 are done and merged (PRs #9–#16): the API runs against the real station; the app has the Now tab
(live player with `expo-audio`, own fallback to the built-in stream URL, reconnects at the live edge on every play,
lock-screen info), the Schedule tab (week list, show pages, local show reminders) and the Station tab (static pages,
team gated on the API's `approved` flag, events). All of it is verified **on the iOS 27 simulator and the Android 16
emulator only** (`status.md`). The app has run informally on one iPhone (a demo build), but
`docs/mobile-app/iphone-test-checklist.md` has not been worked through. The only deployment is a demo copy of the API on
Cloudflare's free plan (personal account); there are no store builds.

**Next:** run the checks in `docs/mobile-app/iphone-test-checklist.md` on a real iPhone (needs the owner's phone), then
plan step 7 (Archive tab, behind a flag until the station decides). Design polish (step 8) is done on the simulator: see
`docs/mobile-app/design-polish.md`. Use
`react-native-track-player` only if the iPhone audio checks fail with `expo-audio`. Open decisions for the station
(roster gating, archives, bundle ID, store accounts) are listed in `status.md`.

## Rules

- **Licensing (webcasting, 17 U.S.C. §114):** never show upcoming songs (upcoming shows are fine);
  show title, artist and album while a track plays; no queue, song picking, per-track replay or
  recording of the live stream. (So a pause must never become a rewind: every Play reconnects live.)
- Live audio plays straight from the stream URL, with a built-in fallback, so the app still plays
  when the API is down. Never proxy audio through the API.
- Mixcloud archives play only inside Mixcloud's own player (WebView); never route that audio
  through our own player.
- Never ship the admin token or call `/v1/admin/*` from the listener app (the client refuses it).
- `null` from the API means unknown: show an explicit sentence, never "TBD".
- The recent-track cover images in `frontend/assets/` are placeholders, not real artwork (the app does not use them).
- The look follows `frontend/index.html`; where the app must differ (licensing, real data, Archive not built) it is
  listed in `docs/mobile-app/design-polish.md`. Add to that list when you differ again.
- The student roster has names and emails: it stays hidden while `/v1/station` says `approved: false` (the app hides it, and the API sends `team: []`).

## Gotchas (details in `status.md`)

- Xcode 27 has **no Simulator.app**: open `/Applications/Xcode.app/Contents/Applications/DeviceHub.app`.
- iOS 27 needs the UIScene setting already in `app.config.ts`; Metro must **not** run with `CI=1`.
- The simulator cannot be tapped from automation, so dev-only env hooks (`EXPO_PUBLIC_AUTOPLAY`, `_DEV_ROUTE`, which
  also scrolls with `/route@600`, and `_DEV_NOW`) drive it. Audio tests are run with the Mac **muted** (the owner is often in class).
- `tools/schedule-snapshot.json` tracks the real calendar; the backend parity test uses
  `backend/mocks/fixtures/schedule-snapshot.json`. Don't mix them up.

## Git

- Work on a branch, open a PR, and squash-merge into `main` (as with #1–#16).
- **Run the backend tests before merging anything that touches `backend/`, `tools/` or the schemas.**
- **No Claude attribution** in commits or PRs: no `Co-Authored-By: Claude` or "Generated with
  Claude Code" lines.
- Say plainly in each PR what was and was not verified.
