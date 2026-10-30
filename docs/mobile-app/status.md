# Mobile app: status and handoff

Read this first when picking the work up. It is the single place that says where the app stands, what
has and has not been verified, what is waiting on people, how to run everything, and what to do next.
Last reviewed **2026-10-30**, against Phase 3 candidate baseline (`17fd878` #30, `3798cf9` #31).
Implementation includes hardening #20, Android #21, design polish #22, Archive demo #23, roster fix #24,
repo checkup/e2e parity fix #26 and Expo patches #27; #28 repaired references after the history rewrite,
#29 reconciled the docs, and #30 established shared instructions/documentation ownership.
#25 was review-only and closed without merging. A documentation-only follow-up does not establish new runtime evidence.

> [!IMPORTANT]
> **Phase 3 Remediation Status (2026-10-30):**
> Candidate history rewritten under owner authorization for Phase 3:
> - **Targeted privacy cleanup across all history:** unapproved leadership roster/contact records omitted from station content, fixtures, preview HTML, and API documentation; individual student email action links repointed to the general station contact route (`wjrh@lafayette.edu`); local home path in design prompts neutralized.
> - **Original demo artwork:** all 15 restricted demo cover blob variants across 20 historical aliases replaced with original abstract geometric placeholder artwork (cream/maroon/radio/vinyl aesthetic) matching exact dimensions and JPEG MIME types.
> - **Truthful prototype framing:** prominent independent prototype disclaimers added to README; cover provenance and runtime/security caveats documented.
> - **Verification Status:** Independent Phase 4 verification remains **pending** (external history tree comparison, secret scanner rerun, and unit/contract/lint/typecheck execution in an isolated runner). No test runs or runtime/build verifications were performed during Phase 3.

- Plan and stack: [`plan.md`](plan.md). Shared rules: [`../../AGENTS.md`](../../AGENTS.md).
- Repository map/commands: [`../../CLAUDE.md`](../../CLAUDE.md). Task/PR workflow and documentation ownership:
  [`../workflow.md`](../workflow.md).
- App code and its own guide: [`../../apps/mobile/README.md`](../../apps/mobile/README.md).
- Real-phone testing, still to do: [`iphone-test-checklist.md`](iphone-test-checklist.md).

## Where it stands

Now, Schedule and Station ran on the **iOS 27 simulator** and the **Android 16 emulator** against the
local API; the Archive demo was checked on iOS only. These runtime checks predate #27's Expo patches and have not
been repeated with those versions. **The app has run informally on one iPhone** (a demo build;
[`iphone-test-checklist.md`](iphone-test-checklist.md) has not been worked through). The only deployment is a demo copy of the
API on Cloudflare's free plan, on a personal account ([`deployed-demo.md`](../backend-proposal/deployed-demo.md)); there are no
store builds.

| Plan step | What | State | PR |
|---|---|---|---|
| 0 | Run the API against the real stream, feed and calendar | Done. No API code changes needed ([`phase0-findings.md`](phase0-findings.md)) | #9 |
| 1 | Audio spike (`expo-audio` vs `react-native-track-player`) | Simulator part passed; **`expo-audio` chosen**. Phone checks pending ([`audio-spike.md`](audio-spike.md)) | #10 |
| 2 | Scaffold: Expo SDK 57, Expo Router tabs, EAS profiles, env config | Done, runs on simulator | #11 |
| 3 | Contract layer: generated types, typed client, query hooks, fixtures | Done, verified against the live local API | #12 |
| 4 | **Now** tab: live player, now-playing, recent, health notices | Done on simulator; phone checks pending | #13 |
| 5 | **Schedule** tab, show pages, local show reminders | Done on simulator; reminder permission and delivery need a phone | #14, #15 |
| 6 | **Station** tab (static pages + team + events) | Done on simulator; links need a phone | #16 |
| 7 | **Archive** tab | **Real archives: not started** (waiting on the station, Decision 002; Mixcloud WebView first). **A demo version exists** with made-up recordings for the board pitch, off unless `EXPO_PUBLIC_DEMO_ARCHIVES=1` ([`archive-demo.md`](archive-demo.md)) | #23 (demo) |
| 8 | Design polish: the app matches `frontend/index.html` (fonts, logo, photos, tab bar, player dock, icon/splash) | **Done on the iOS simulator** and checked on four screens on the Android emulator, light only; real phones and store assets still to do ([`design-polish.md`](design-polish.md)) | #22 |

The throwaway audio-spike app was removed once the real app covered it; it is kept at the git tag `archive/audio-spike`
(`git checkout archive/audio-spike -- apps/audio-spike` restores it).

## What is verified, and what is not

Paths beginning `src/` or `assets/` below are relative to `apps/mobile/`.

Verified before #27 (simulator, Mac muted, so by player state, logs and screenshots, never by ear):
- Live stream plays, keeps playing in the background, and registers lock-screen/Control Center info.
- A dead API stream URL switches to the built-in stream URL by itself; the whole API being down still plays.
- Now, Schedule (list, show page, load-failed notice), Station (hub, events, contact, team both approved and not).
- Types generated from the schemas, fixtures valid against them, client + hooks against the live local API.
- A mid-stream stall with no error (stream connection killed while playing) is noticed after ~20 s and recovered by
  itself, on the same URL when it is back and on the built-in URL when it is not (`src/audio/stall-watchdog.ts`).
- Saved answers (iOS simulator, API stopped): after a normal run, three launches in a row with no API still show
  the Schedule week and, on Now, the last known show and track (dimmed, "Showing last known info from 11:51 AM.");
  Recently played is not saved and says it is unavailable. With the API unreachable and an earlier run's answer saved,
  Now shows "Waiting for track information" rather than the old track as playing now. The offline wording was
  checked through the dev hook only (`EXPO_PUBLIC_DEV_OFFLINE=1`), not by really losing the connection.
- Live player after the lint-driven refactor of `use-live-player.ts` (refs updated in an effect, stall clock
  started at Play): normal play, and a dead stream URL switching to the built-in one then playing
  (`fallback=true`), both by the `[live]` log.
- **Design polish (#22), iPhone 17 simulator:** every screen (Now, Schedule, a show page, the Station hub and all seven
  pages, top and bottom of each) was screenshotted next to the same screen of the design and compared by eye and by
  pixel position: layout, sizes and text agree to about a point, apart from the deliberate differences listed in
  [`design-polish.md`](design-polish.md). The narrow layouts (under 400 pt wide, which is most iPhones) were checked on
  the same simulator by temporarily raising the breakpoint above 402 and forcing the design's narrow rules at 402: Schedule
  and the Station hub agree; a real 390/393 pt phone was not used (the iPhone 17e simulator could not be driven, see
  Gotchas). Done with fixture data; the live API was not behind these shots.
- ESLint is clean (`npm run lint`). Unit tests, typecheck, `check:contract`, `smoke:api` against `dev.sh`.
- **`expo-doctor` passed 21/21 in merged PR #27** (`e950ff1`, 2026-10-15), which installed patch releases of 8 packages
  (`expo` 57.0.30, `expo-asset`, `expo-constants`, `expo-dev-client`, `expo-linking`, `expo-notifications`,
  `expo-router`, `expo-splash-screen`). Typecheck, 89 unit tests, `check:contract`, lint and `smoke:fixtures` passed;
  an iOS simulator Debug build compiled, but the app was **not launched**. **Still pending after #27:** `npm ci`,
  dev-client rebuild and simulator/emulator runtime checks, plus rebuilding the phone demo with
  `apps/mobile/scripts/build-phone.sh --prebuild`. No new device verification is implied by that compile.

**Android 16 emulator** (Pixel 6 AVD `wjrh-api36`, arm64, 4 GB RAM; Mac muted and the emulator started `-no-audio`).
Taps work here (`adb shell input tap`), unlike on the iOS simulator:
- The dev build compiles (about 10 min the first time) and runs. Now, Schedule, a show page and Station render; Archive is hidden.
- The live player plays the API's stream URL and keeps playing **3.5+ minutes in the background**: a foreground
  media service, an `AudioTrack` still `started`, and a media notification with title and artist, a Pause button and
  **no scrub bar or skip buttons**. Pausing and resuming from that notification follow into the app, and resuming
  reconnects (idle → connecting → playing). This is the resume path that was only exercised in code on iOS.
- **A bug found and fixed here:** when the stream server closed the connection, Android reported playback as
  *ended* (no error, not buffering), the hook read that as the listener pausing from outside, and went idle: the
  listener had to press Play again. Now an ended live stream is a dropped connection (`isDropped` in
  `src/audio/stall-watchdog.ts`): ended → "Reconnecting…" → built-in URL → playing, with no tap.
- Notifications: on a fresh install (no audio played yet) the system permission prompt appears; Allow → "Reminder on"
  and the alarms are scheduled. A reminder is delivered ("Giuseppe is starting", "with Cameron, Mats · WJRH 104.9 FM")
  and tapping it with the app in the background opens that show's page (it takes a few seconds).
- Real offline (airplane mode): "You're offline. Showing last known info from …" with the track dimmed. Turning it
  off clears the notice and refreshes Now without a pull; the player kept retrying until the stream was reachable.
- Plain-HTTP is allowed only in the development variant (checked in the resolved config for both, and in the dev APK's manifest).

**Found on Android and NOT fixed** (decisions or risks, details in the PR):
- **Reminders are inexact and arrive late.** Android has no exact-alarm permission in the app, so each reminder is an
  alarm with a one-hour window (`dumpsys alarm` shows `window=+1h`). Measured twice on an awake emulator: delivered
  about **4 min 15 s after** the show's start. Real idle-phone timing, including Doze, is unverified;
  the alarm's one-hour window is not a measured delivery guarantee. iOS delivery timing is also unverified. Options:
  (a) `USE_EXACT_ALARM` (granted automatically, but Google Play only allows it for alarm, timer and calendar-style
  apps, so the station must decide whether a show reminder qualifies); (b) `SCHEDULE_EXACT_ALARM` (the listener must
  allow "Alarms & reminders" in Settings, so it needs a small prompt flow); (c) keep inexact and reword so a late one
  is not wrong ("Giuseppe starts at 5:00 PM" rather than "is starting"). Recommendation: (c) now, decide (a) vs (b) with the station.
- The reminder's small icon was a plain white circle. Design polish adds a white broadcast symbol
  (`assets/notification-icon.png`, tinted maroon); not yet seen on a device.
- **An intermittent native crash, seen once and not reproduced.** SIGSEGV on the JS thread (`mqt_v_js`) inside
  `libreactnative.so`'s Fabric mounting/shadow-tree code, a few seconds after a fresh-data launch while tapping
  between tabs (fault address decodes to text, so it looks like a use-after-free). Three repeats of the same steps
  did not crash. React Native 0.86.3, Android 16 emulator. Watch for it on a real device; if it recurs, keep the
  tombstone (`adb logcat -b crash`) and report it upstream.
- The player log showed a brief "connecting" (buffering) blip about once a minute in the background against the
  local fake stream through the `adb` tunnel; it never reconnected or fell back. Not seen on iOS; recheck against the real stream.

**Not re-run after the refactor:** the stall watchdog (stream dies mid-play with no error). Its pure logic is
unit-tested and the code path is unchanged apart from where its clock starts, but re-check it on the simulator
(kill the fake stream while playing, expect "Reconnecting…" after about 20 s) before relying on it.

**Not verified. Needs a real iPhone** (full list with steps in [`iphone-test-checklist.md`](iphone-test-checklist.md)):
how the lock screen looks and its controls; pausing/resuming from it (the resume path reconnects at the live
edge but has only been exercised in code); call/Siri interruptions; headphones and Bluetooth; Wi-Fi to cellular;
the silent switch; a 30+ minute background run; the notification permission prompt, a reminder arriving at a
show's start, and tapping it; Mail/Phone/Safari opening from Station links. **Design polish on a phone:** how the blurred
player dock, fonts, status bar, app icon and splash look, the home-indicator spacing, Reduce Motion, and the largest
text size (section J of the checklist).
**Design polish on the Android emulator** (Pixel 6 AVD, Mac muted, `-no-audio`): the dev build compiles from this branch
(about 9 min) and runs; Now, Schedule (opens at today's bar, also when you press the tab), a show page and the Station hub
were compared with the design at 411 dp and agree; the status-bar icons turn dark on the cream Station screens; the
player reached "playing" against the fake stream. **Not seen on Android:** the other Station pages, the notification
small icon, the adaptive and themed icons, the splash, and the dock's look beyond "near-solid cream, no blur".
The emulator showed its own "System UI isn't responding" box once, right after the build while the Mac was busy
(see the RAM note under "Android emulator"); and `expo run:android` failed to *install* once because the emulator's
system services were not up yet (the build was fine; `adb install -r <apk>` afterwards worked).
**Not verified on Android** (needs a physical device or more time): a real phone; a 30+ minute background run;
call and other-app audio-focus interruptions; headphones and Bluetooth; battery optimisation and Doze with an idle phone
(reminders could be later still); a cold start from a tapped reminder (a warm start works); the real station stream for
the long runs (the fallback to it was exercised, muted); dark mode; large text.

## Waiting on people (not engineering)

1. **Roster approval gating (decided conservatively, confirm):** while `/v1/station` says `approved: false` the
   Team page hides all names/emails, and since #24 the API itself sends `team: []` (the demo API sent the roster for
   about 12 hours before that; [`deployed-demo.md`](../backend-proposal/deployed-demo.md)). Should it? Should events also wait? (`teamView`, `src/screens/station/station-state.ts`.)
2. **Archives** (Decision 002): whether to ship them, and how (Mixcloud). Also confirm Mixcloud's widget terms
   allow embedding in a station app. Real archives stay off until then; the sample Archive tab can be enabled for a demo.
3. **Bundle ID / package name:** `org.wjrh.app` is a placeholder in `apps/mobile/app.config.ts`. It cannot change
   after the first store release.
4. **Apple Developer ($99/yr) and Google Play ($25) accounts:** who owns them. They should belong to the station.
5. Minimum OS versions; whether Expo web is a target; whether the station wants crash reporting (see `plan.md`).
6. **Station copy to recheck before launch** (`apps/mobile/src/content/station.ts`): board-meeting time, GroupMe
   invite, donation link. Last verified against wjrh.org on 21 Sep 2026.
7. **Reminder wording** ("<show> is starting", body "with <hosts> · WJRH 104.9 FM") is mine; the station may want
   something else. **Android reminder timing** (inexact one-hour window, about 4 min late on the emulator; idle-phone timing unverified): pick exact alarms
   (and whether Google Play allows `USE_EXACT_ALARM` for this) or reword. See "Found on Android and NOT fixed".
8. Deploying the API for real (Decision 001, Cloudflare): a station-owned account and a station domain. A demo copy already
   runs on a personal account ([`deployed-demo.md`](../backend-proposal/deployed-demo.md)). The app's preview/production builds
   still need `EXPO_PUBLIC_API_BASE` set in `eas.json`.

## Next steps, in order

0. **Phase 4 verification gate:** Codex independently inspects candidate history trees, confirms 0 restricted blobs and unapproved student records, reruns credential scanner in clean sandbox with development-default adjudication, and executes unit/typecheck/contract checks in an appropriately bounded test environment before any Phase 5 clean export or publication authorization.
1. **Complete verification after #27 before substantial feature expansion** (agent, with the owner's explicit
   authorization for app/audio-state runs): install dependencies, rebuild the native dev clients, and repeat the
   affected iOS simulator/Android emulator checks with the current dependency versions. Specifically re-run the iOS
   silent-stall watchdog scenario not repeated after #20: kill the fake stream mid-play, expect recovery after about
   20 s. Keep the Mac muted and the Android emulator at `-no-audio`; record code/PR, device and actual outcomes here.
   Rebuild the phone demo with `apps/mobile/scripts/build-phone.sh --prebuild`. Then the **owner with an iPhone** runs
   [`iphone-test-checklist.md`](iphone-test-checklist.md), records build/device/date/results there and updates this
   doc's verification summary. These runs remain **pending**; the automated PR checks do not perform them. If
   lock-screen/background/interruption fails with `expo-audio`, evaluate `react-native-track-player` before building more.
2. Settle the decisions above that block work (roster gating and bundle ID are the cheap ones).
3. **Step 7, Archive tab** behind the flag (Mixcloud widget in a WebView; audio must stay inside Mixcloud's player;
   live and archive audio are mutually exclusive: starting one stops the other).
4. Design follow-ups (step 8 itself is done): connect the existing demo Archive screens to real data and playback when step 7 is built; real
   artwork from the station (shows and tracks) in place of the collage; a brand kit if the station has one (the icon
   and splash are my layout); store screenshots and listing text.
5. Hardening ideas still open: `eas init` and a first EAS build; an Android run on a real phone. (Done: ESLint, the
   saved last good answers across restarts, the offline notice, and an emulator run; see "What is verified".)

### Repository housekeeping (separate from app verification)

- **Review and retire the old `repo-checkup` worktree** (owner/agent, after confirming no session is using it).
  On 2026-10-15 it was clean at `2813947`, on branch `docs-expo-status`, under the repo-relative path
  `.claude/worktrees/repo-checkup`. Its one branch-only commit updates the doctor/pending-runtime wording in
  `CLAUDE.md` and this status doc. Compare it with the current docs and preserve any unique work before removing
  the worktree or deleting a branch; commit ancestry alone does not establish whether squash-merged work is covered.
  The #29 reconciliation already records the same doctor result/runtime gap, but review the actual diff first.
  Cleanup is **pending**, and nothing was removed as part of the automated-check work.

## Run everything (macOS, Xcode 27)

```bash
# Backend + checks
backend/scripts/dev.sh                  # fake station + API on http://127.0.0.1:8787   (Ctrl-C stops it)
backend/scripts/dev-real.sh             # API against the REAL station, :8797, read-only
API_HOST=0.0.0.0 backend/scripts/dev-real.sh   # same, reachable from a phone on the same Wi-Fi (never campus Wi-Fi: use a hotspot or the demo API)
(cd backend/api && npm ci && npm test)  # run this whenever you touch backend/, schemas, tools/
python3 tools/check_station_services.py # read-only check of the real stream, feed, calendar

# App checks (apps/mobile)
cd apps/mobile
npm ci
npm run typecheck && npm test && npm run check:contract && npm run lint   # all must pass
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

### Android emulator (set up and run on 2026-10-13; the SDK is `~/Library/Android/sdk`)

One-time setup (the Mac already had the emulator, platform-tools, platform 37 and build-tools; this added the rest):
```bash
export ANDROID_HOME=~/Library/Android/sdk JAVA_HOME=$(/usr/libexec/java_home -v 17)
export PATH=$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH
# cmdline-tools: unzip Google's commandlinetools-mac-*_latest.zip into $ANDROID_HOME/cmdline-tools/latest
sdkmanager "system-images;android-36;google_apis;arm64-v8a"   # needs the android-sdk-arm-dbt-license accepted (sdkmanager --licenses)
avdmanager create avd -n wjrh-api36 -k "system-images;android-36;google_apis;arm64-v8a" -d pixel_6
# Edit ~/.android/avd/wjrh-api36.avd/config.ini: hw.ramSize = 4096M (the 1536M default makes System UI time out)
```
Each run:
```bash
emulator -avd wjrh-api36 -no-audio -no-snapshot &       # -no-audio on top of muting the Mac
backend/scripts/dev.sh                                  # API on the Mac's 127.0.0.1:8787
cd apps/mobile
APP_VARIANT=development npx expo run:android            # prebuild + Gradle + install (about 10 min the first time; android/ is gitignored)
adb reverse tcp:8081 tcp:8081                           # Metro (expo run:android does this)
adb reverse tcp:8801 tcp:8801                           # the fake stream: the API hands out http://127.0.0.1:8801/
APP_VARIANT=development EXPO_PUBLIC_API_BASE=http://10.0.2.2:8787 npx expo start --dev-client --port 8081
adb shell am start -a android.intent.action.VIEW -d 'exp+wjrh://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081\&disableOnboarding=1'
adb exec-out screencap -p > shot.png                    # screenshot
adb shell input tap X Y                                 # tap (Pixel 6 is 1080x2400; tab bar y is about 2232)
adb shell cmd connectivity airplane-mode enable|disable # real offline
```
Player and notification checks: `adb shell dumpsys media_session` (PLAYING / PAUSED / STOPPED / ERROR), `dumpsys audio`
(an `AudioTrack` for the app with `state:started`), `dumpsys activity services org.wjrh.app` (foreground service),
`dumpsys alarm` (scheduled reminders), `dumpsys notification --noredact`, `adb logcat -b crash` (native crashes).
To test a reminder without waiting for the show: `adb shell settings put global auto_time 0`, then
`adb shell cmd alarm set-time <epoch-ms>` to just before the alarm (no root needed). Put the clock back afterwards:
`settings put global auto_time 1` and `cmd alarm set-time` with the Mac's current time.

### Environment variables (all `EXPO_PUBLIC_*` are baked in at bundle time: restart Metro after changing)

| Variable | Effect |
|---|---|
| `APP_VARIANT=development` | Build profile. Allows plain-HTTP to local addresses (iOS `NSAllowsLocalNetworking`, Android cleartext). Never set for preview/production |
| `EXPO_PUBLIC_API_BASE` | API address. Default in dev: `http://127.0.0.1:8787`. Android emulator `http://10.0.2.2:8787`; phone `http://<LAN IP>:8787` |
| `EXPO_PUBLIC_USE_FIXTURES=1` | Serve `src/api/fixtures` instead of calling the API |
| `EXPO_PUBLIC_AUTOPLAY=1` | **Dev only.** Presses Play 4 s after launch |
| `EXPO_PUBLIC_DEV_ROUTE=/a,/b` | **Dev only.** Navigates to each route 5 s apart after launch; `/a@600` also scrolls that screen 600 pt; each settled screen logs `[dev-shot N]` (used by `tools/design-compare`) |
| `EXPO_PUBLIC_DEV_NOW=2026-10-14T19:10:00-04:00` | **Dev only.** The schedule's clock, to see "ON AIR NOW" at any hour |
| `EXPO_PUBLIC_DEV_OFFLINE=1` | **Dev only.** Makes the Now tab think the phone is offline, to see the offline notice (the simulator can't be taken offline without cutting the Mac's own network) |

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
- **Typed routes:** stale `.expo/types` can make `tsc` reject a valid route. `npm run typecheck` now refreshes the
  ignored types with `npm run gen:routes` before checking; generation uses Expo's headless `customize tsconfig.json`
  command in CI mode, with no Metro server. Do not commit `.expo/` or `expo-env.d.ts`.
- **`npx expo install` can fail with ERESOLVE** unless `react-dom` is pinned to the same version as `react`.
  It also puts `eslint-config-expo` in `dependencies` whatever flags you pass; move it to `devDependencies` by hand.
- **Saved answers are keyed on the schemas.** `npm run gen:types` writes `src/api/schema-version.ts`, a hash of
  `backend/schemas`; any schema change makes the phone discard its saved answers on the next launch. Commit the
  regenerated file with the schema change. If you change *how* answers are saved, bump `CACHE_FORMAT` in
  `src/api/cache-rules.ts`.
- **Queries are not paused when the phone is offline.** NetInfo only drives the Now tab's notice and a refresh on
  reconnect (`query-provider.tsx`). Wiring NetInfo into TanStack's `onlineManager` would make offline screens sit on
  "Loading…" forever instead of showing their "couldn't load" message, so don't, without reworking those screens.
- **Backend parity test:** it compares the API on a frozen fixture calendar with
  `backend/mocks/fixtures/schedule-snapshot.json`. `tools/schedule-snapshot.json` tracks the *real* calendar and
  is only used by the drift check. Do not point the test at the latter (that broke `main` after #9). `e2e.py`'s
  "legacy parser" check had the same mix-up until 2026-10-15.
- **Android emulator gotchas.** (1) Give the AVD 4 GB of RAM; the 1.5 GB default thrashed (`kcompactd`) and System UI
  stopped responding. (2) `adb root`, or killing the `adb` server, **drops every `adb reverse` rule**: Metro's log
  stops and the stream at `127.0.0.1:8801` becomes "connection refused". Re-add the rules. (3) `lsof -ti :8801 | xargs kill`
  also kills `adb` (it holds a connection to that port); kill the listener: `lsof -nP -iTCP:8801 -sTCP:LISTEN`.
  (4) The first dev-client launch shows an onboarding sheet; add `&disableOnboarding=1` to the URL. (5) The emulator
  reaches the Mac at `10.0.2.2`, but only `adb reverse` makes the *Mac's* fake stream reachable at the 127.0.0.1 address
  the API returns. (6) Metro's `[live]` lines stop if the dev client loses Metro (airplane mode, lost `adb reverse`), so
  do not trust a frozen log; use `dumpsys media_session` as ground truth. (7) A native crash shows up only in `logcat -b crash`.
- **Android reports a closed live stream as "ended", not as an error** (`playbackState: 'ended'`, `didJustFinish`), so
  it needs its own handling (`isDropped`). iOS never showed this.
- **`json.tool` in Python 3.14 colorizes output** into files; write JSON with `json.dumps`.

- **The tab bar and player dock float over the screens** (`src/components/tab-bar.tsx`), so every scrolling screen must
  leave room at the bottom (`useBottomChrome` in `dock-metrics.ts`; the amounts are the design's). A new screen that
  forgets it ends up with its last item under the dock.
- **Design polish added native modules** (`react-native-svg`, `expo-image`, `expo-linear-gradient`, `expo-blur`): rebuild
  the dev client after pulling it (`APP_VARIANT=development npx expo run:ios`), or the app crashes on launch.
- **React Native draws the display font about 0.095 em higher than a browser.** Use `DisplayText` (not `Text`) for
  anything in "WJRH Display", or it will sit a few points high against the design (`DISPLAY_NUDGE`, `theme.ts`).
- **The first `exp+wjrh://` link on a simulator you have not used before shows iOS's "Open in…?" box**, which cannot
  be tapped from automation. The iPhone 17 simulator had been approved by hand earlier; a fresh one (the 17e) was not,
  so scripted runs only work on a simulator where someone clicked Open once in the DeviceHub window.
- **Hot reload restarts the dev route sequence** (`EXPO_PUBLIC_DEV_ROUTE`); do not edit app source during a capture run.

## Working agreements

The authoritative shared rules, including author identity, no audio and merge authorization, live in
[`../../AGENTS.md`](../../AGENTS.md). Follow [`../workflow.md`](../workflow.md) for task startup, checks,
documentation in the same PR and handoff. Keep current progress and verification here; do not duplicate the rules.

Why the verification rule matters: PR #9 was merged without re-running backend tests and left one failing parity
test until #14 fixed it. Respect task-specific restrictions, and record unperformed checks as pending rather than
silently treating an earlier result as current.
