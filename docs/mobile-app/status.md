# Mobile app: status and handoff

Read this first when picking the work up. It is the single place that says where the app stands, what
has and has not been verified, what is waiting on people, how to run everything, and what to do next.
Last updated **2026-10-02** (after PR #17 and a cleanup pass).

- Plan, stack and rules: [`plan.md`](plan.md). Project rules and commands: [`../../CLAUDE.md`](../../CLAUDE.md).
- App code and its own guide: [`../../apps/mobile/README.md`](../../apps/mobile/README.md).
- Real-phone testing, still to do: [`iphone-test-checklist.md`](iphone-test-checklist.md).

## Where it stands

All four planned screens exist and run on the **iOS 27 simulator** against the local API. **Nothing has been run
on a physical phone or on Android yet**, and nothing is deployed (the API is local only, no store builds).

| Plan step | What | State | PR |
|---|---|---|---|
| 0 | Run the API against the real stream, feed and calendar | Done. No API code changes needed ([`phase0-findings.md`](phase0-findings.md)) | #9 |
| 1 | Audio spike (`expo-audio` vs `react-native-track-player`) | Simulator part passed; **`expo-audio` chosen**. Phone checks pending ([`audio-spike.md`](audio-spike.md)) | #10 |
| 2 | Scaffold: Expo SDK 57, Expo Router tabs, EAS profiles, env config | Done, runs on simulator | #11 |
| 3 | Contract layer: generated types, typed client, query hooks, fixtures | Done, verified against the live local API | #12 |
| 4 | **Now** tab: live player, now-playing, recent, health notices | Done on simulator; phone checks pending | #13 |
| 5 | **Schedule** tab, show pages, local show reminders | Done on simulator; reminder permission and delivery need a phone | #14, #15 |
| 6 | **Station** tab (static pages + team + events) | Done on simulator; links need a phone | #16 |
| 7 | **Archive** tab | **Not started.** Hidden behind `FEATURES.archive = false` until the station decides (Decision 002); Mixcloud WebView first | |
| 8 | Design polish: fonts, logo, photos, light/dark, accessibility pass, icon/splash, store assets | **Not started.** Current styling is placeholder-level on the design's palette | |

The throwaway audio-spike app was removed once the real app covered it; it is kept at the git tag `archive/audio-spike`
(`git checkout archive/audio-spike -- apps/audio-spike` restores it).

## What is verified, and what is not

Verified (simulator, Mac muted, so by player state, logs and screenshots, never by ear):
- Live stream plays, keeps playing in the background, and registers lock-screen/Control Center info.
- A dead API stream URL switches to the built-in stream URL by itself; the whole API being down still plays.
- Now, Schedule (list, show page, load-failed notice), Station (hub, events, contact, team both approved and not).
- Types generated from the schemas, fixtures valid against them, client + hooks against the live local API.
- A mid-stream stall with no error (stream connection killed while playing) is noticed after ~20 s and recovered by
  itself, on the same URL when it is back and on the built-in URL when it is not (`src/audio/stall-watchdog.ts`).
- Unit tests (28), `expo-doctor` (21/21), backend tests (50/50), typecheck.

**Not verified. Needs a real iPhone** (full list with steps in [`iphone-test-checklist.md`](iphone-test-checklist.md)):
how the lock screen looks and its controls; pausing/resuming from it (the resume path reconnects at the live
edge but has only been exercised in code); call/Siri interruptions; headphones and Bluetooth; Wi-Fi to cellular;
the silent switch; a 30+ minute background run; the notification permission prompt, a reminder arriving at a
show's start, and tapping it; Mail/Phone/Safari opening from Station links.
**Android has not been run at all.**

## Waiting on people (not engineering)

1. **Roster approval gating (decided conservatively, confirm):** while `/v1/station` says `approved: false` the
   Team page hides all names/emails. Should it? Should events also wait? (`teamView`, `src/screens/station/station-state.ts`.)
2. **Archives** (Decision 002): whether to ship them, and how (Mixcloud). Also confirm Mixcloud's widget terms
   allow embedding in a station app. The Archive tab stays off until then.
3. **Bundle ID / package name:** `org.wjrh.app` is a placeholder in `apps/mobile/app.config.ts`. It cannot change
   after the first store release.
4. **Apple Developer ($99/yr) and Google Play ($25) accounts:** who owns them. They should belong to the station.
5. Minimum OS versions; whether Expo web is a target; whether the station wants crash reporting (see `plan.md`).
6. **Station copy to recheck before launch** (`apps/mobile/src/content/station.ts`): board-meeting time, GroupMe
   invite, donation link. Last verified against wjrh.org on 21 Sep 2026.
7. **Reminder wording** ("<show> is starting", body "with <hosts> · WJRH 104.9 FM") is mine; the station may want
   something else.
8. Deploying the API (Decision 001, Cloudflare). The app's preview/production builds need `EXPO_PUBLIC_API_BASE`.

## Next steps, in order

1. **Run the iPhone checks** ([`iphone-test-checklist.md`](iphone-test-checklist.md)) and record results there. Four
   screens of unverified device behavior is the biggest risk. If lock-screen/background/interruption fails with
   `expo-audio`, try `react-native-track-player` (the plan's fallback) before building more.
2. Settle the decisions above that block work (roster gating and bundle ID are the cheap ones).
3. **Step 7, Archive tab** behind the flag (Mixcloud widget in a WebView; audio must stay inside Mixcloud's player;
   live and archive audio are mutually exclusive: starting one stops the other).
4. **Step 8, design polish** (WJRH Display = Barlow Condensed ExtraBold, logo and station photos from
   `frontend/assets/`, skip `recent-cover-*` which are placeholders, accessibility pass, icon/splash, store assets).
5. Hardening ideas, not started: persist the last good API answers across app restarts (needs an async-storage
   persister for TanStack Query); an offline indicator; Android run; `eas init` and a first EAS build; ESLint
   (the `lint` script exists but no config has been set up or run).

## Run everything (macOS, Xcode 27)

```bash
# Backend + checks
backend/scripts/dev.sh                  # fake station + API on http://127.0.0.1:8787   (Ctrl-C stops it)
backend/scripts/dev-real.sh             # API against the REAL station, :8797, read-only
API_HOST=0.0.0.0 backend/scripts/dev-real.sh   # same, reachable from a phone on the same Wi-Fi
cd backend/api && npm ci && npm test    # 50 tests; run this whenever you touch backend/, schemas, tools/
python3 tools/check_station_services.py # read-only check of the real stream, feed, calendar

# App checks (apps/mobile)
npm ci
npm run typecheck && npm test && npm run check:contract      # all must pass
npm run smoke:api                       # real client vs the running dev.sh stack
npm run smoke:fixtures                  # same, offline fixtures
npm run gen:types                       # after any backend/schemas change; commit the result
npx expo-doctor                         # must be 21/21

# Simulator
open /Applications/Xcode.app/Contents/Applications/DeviceHub.app   # Xcode 27 has NO Simulator.app; this gives the sim a window
xcrun simctl list devices               # find an iPhone UDID (this machine used iPhone 17)
APP_VARIANT=development npx expo run:ios --device <UDID> --no-bundler   # build + install (minutes); redo after adding a native module
APP_VARIANT=development npx expo start --dev-client --port 8081         # Metro. NOT with CI=1
xcrun simctl openurl booted "exp+wjrh://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081&disableOnboarding=1"
xcrun simctl io booted screenshot /path/shot.png
```

### Environment variables (all `EXPO_PUBLIC_*` are baked in at bundle time: restart Metro after changing)

| Variable | Effect |
|---|---|
| `APP_VARIANT=development` | Build profile. Allows plain-HTTP to local addresses (iOS `NSAllowsLocalNetworking`, Android cleartext). Never set for preview/production |
| `EXPO_PUBLIC_API_BASE` | API address. Default in dev: `http://127.0.0.1:8787`. Android emulator `http://10.0.2.2:8787`; phone `http://<LAN IP>:8787` |
| `EXPO_PUBLIC_USE_FIXTURES=1` | Serve `src/api/fixtures` instead of calling the API |
| `EXPO_PUBLIC_AUTOPLAY=1` | **Dev only.** Presses Play 4 s after launch |
| `EXPO_PUBLIC_DEV_ROUTE=/a,/b` | **Dev only.** Navigates to each route 8 s apart after launch |

The dev-only hooks exist because the simulator cannot be tapped from automation (see below). They are ignored in
release builds (`__DEV__` is false).

## Silent testing (the owner is often in class)

Audio from the simulator comes out of the Mac. Before any run that can play audio, mute and check:
`osascript -e 'set volume output volume 0' -e 'set volume with output muted'` then
`osascript -e 'get volume settings'` (expect `output muted:true`) and confirm the output device is the built-in
speakers. Verify playback from state instead: the player logs `[live] state=… fallback=…` into Metro's output.
The last session ended with the Mac muted at volume 0; the previous volume was not recorded, so the owner
unmutes it themselves. The real app plays at full volume.

## Gotchas learned the hard way

- **Xcode 27 has no `Simulator.app`.** Use DeviceHub (above), otherwise the sim runs with no window.
- **iOS 27 kills apps without the UIScene lifecycle** (SIGTRAP at launch, before JS). Fixed by
  `expo-build-properties` `ios.enableSceneSupport: true` in `app.config.ts`; Expo SDK 58 should do it by default
  (remove the workaround when upgrading).
- **Metro must not run with `CI=1`** (it stops watching files and serves a stale bundle) and must listen on IPv4
  (plain `expo start`, not `--localhost`) for the simulator's `127.0.0.1`.
- **No tapping from automation.** `osascript` has no accessibility access; there is no `idb`. So screens are reached
  with the dev hooks, and anything behind an iOS system dialog cannot be driven. `simctl privacy` cannot grant
  notifications. `simctl openurl` with a custom scheme (`wjrh://…`) shows an "Open in…?" dialog that cannot be
  dismissed except by `xcrun simctl shutdown booted` then `boot`; the `exp+wjrh://expo-development-client/…`
  URL does not show it.
- **iOS refuses to schedule local notifications without permission** (error 2003 "Source is not authorized"), so
  reminders cannot be exercised on the simulator past the permission state.
- **`expo-audio` does not recover from a failed load or a stall on its own.** A failed load reports `error` once and
  sits "buffering"; a dropped connection raises no error at all and sat on "Connecting…" for 95 s+ in a test. The
  app's own fallback/retry and stall watchdog (`src/audio/use-live-player.ts`, `stall-watchdog.ts`) handle both. It also needs `expo-asset` installed
  (peer dependency; `expo-doctor` catches it).
- **The stream takes about 7 s to start** and its `currentOffsetFromLive` is always `null`; it also answers at *any* URL
  path, so test failure handling with an unreachable host, not a wrong path (`audio-spike.md`, earlier run).
- **Resuming a paused live stream would play from an old buffer** (a rewind, which the licensing rules forbid), so
  every Play and every resume from outside the app reconnects at the live edge.
- **Typed routes:** after adding a route file, run Metro once so `.expo/types` regenerates, or `tsc` reports the new
  path as not assignable. (`.expo/` is gitignored.)
- **`npx expo install` can fail with ERESOLVE** unless `react-dom` is pinned to the same version as `react`.
- **Backend parity test:** it compares the API on a frozen fixture calendar with
  `backend/mocks/fixtures/schedule-snapshot.json`. `tools/schedule-snapshot.json` tracks the *real* calendar and
  is only used by the drift check. Do not point the test at the latter (that broke `main` after #9).
- **`json.tool` in Python 3.14 colorizes output** into files; write JSON with `json.dumps`.

## Working agreements

- Branch, PR, **squash-merge** into `main` (as #1 to #16). **No Claude attribution** in commits or PRs: no
  `Co-Authored-By` or "Generated with" lines.
- Explain things plainly and briefly; the owner is learning. Check before assuming on judgment calls, and flag them
  in the PR (the roster gating is an example).
- Say plainly what was and was not verified, in the PR and in the final message.
- **Run the backend tests before merging anything that touches `backend/`, `tools/` or the schemas.** PR #9 was
  merged without re-running them and left `main` with one failing test until #14 fixed it.
- The owner has been giving broad go-aheads ("go for it", "whatever is best"): finish a step end to end (build,
  verify, docs, PR, merge) before asking what is next, but never merge unverified work without saying so.
