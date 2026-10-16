# WJRH mobile app (Expo)

The native iOS and Android listener app (Expo SDK 57, React Native, Expo Router, TypeScript). This guide owns app
setup, source layout, scripts and environment variables. Current feature completion, verification and pending
device/dependency checks live in [`docs/mobile-app/status.md`](../../docs/mobile-app/status.md); do not copy that
handoff into this overview. The sample Archive's behavior and flag are documented in
[`archive-demo.md`](../../docs/mobile-app/archive-demo.md).
Verification paragraphs below describe earlier recorded checks; use the status doc to establish whether those
results cover the current code and dependency versions.

- Where things stand, next steps, gotchas, decisions waiting on people: [`docs/mobile-app/status.md`](../../docs/mobile-app/status.md)
- Stack, screen-to-endpoint map, licensing rules, build order: [`docs/mobile-app/plan.md`](../../docs/mobile-app/plan.md)
- What still needs a real phone: [`docs/mobile-app/iphone-test-checklist.md`](../../docs/mobile-app/iphone-test-checklist.md)
- Audio library choice: [`docs/mobile-app/audio-spike.md`](../../docs/mobile-app/audio-spike.md)

## Run it (iOS Simulator)

```bash
backend/scripts/dev.sh                     # in another terminal: the API on http://127.0.0.1:8787
cd apps/mobile && npm ci
APP_VARIANT=development npx expo run:ios   # builds a development app, installs it, starts Metro
```

- Xcode 27 has no Simulator app: open `/Applications/Xcode.app/Contents/Applications/DeviceHub.app` to get a window.
- Do **not** run Metro with `CI=1`: it stops watching files and serves a stale bundle.
- After adding a native module (anything with native code), rebuild with `expo run:ios`; JS changes just reload.
- Adding a route file? `npm run typecheck` refreshes the ignored Expo Router types without Metro; use
  `npm run gen:routes` for generation alone. Otherwise a stale local file can make `tsc` reject a valid new route.
- A real phone needs more steps (LAN API, signing): [`iphone-test-checklist.md`](../../docs/mobile-app/iphone-test-checklist.md).
- More simulator commands (boot, deep link into the dev build, screenshots): [`status.md`, "Run everything"](../../docs/mobile-app/status.md#run-everything-macos-xcode-27).

## Run it (Android emulator)

Needs the Android SDK with an arm64 Android 16 system image and an AVD with 4 GB of RAM; the one-time setup and every
command, with the pitfalls found (RAM, `adb reverse`, notification timing), are in [`status.md`, "Android emulator"](../../docs/mobile-app/status.md#android-emulator-set-up-and-run-on-2026-10-13-the-sdk-is-libraryandroidsdk).

```bash
emulator -avd wjrh-api36 -no-audio -no-snapshot &
backend/scripts/dev.sh                         # in another terminal
cd apps/mobile && adb reverse tcp:8081 tcp:8081 && adb reverse tcp:8801 tcp:8801
APP_VARIANT=development EXPO_PUBLIC_API_BASE=http://10.0.2.2:8787 npx expo run:android
```

Unlike the iOS simulator, an Android emulator can be tapped from automation (`adb shell input tap`) and taken offline
(`adb shell cmd connectivity airplane-mode enable`).

## Scripts

| Command | What |
|---|---|
| `npm run typecheck` | Generate ignored Expo Router types, then check app code **and** `scripts/` (two tsconfigs). Must pass |
| `npm run gen:routes` | Generate `.expo/types` and Expo TypeScript environment files without Metro (`expo customize tsconfig.json` in CI mode); do not commit these generated files |
| `npm test` | Unit tests (Node's test runner via `tsx`) for the pure logic: Now, Schedule/station time, reminder planner, Station |
| `npm run check:contract` | Offline fixtures still validate against `backend/schemas` |
| `npm run smoke:api` | Real API client vs the running `backend/scripts/dev.sh` stack; validates every response, the error envelope and the admin guard |
| `npm run smoke:fixtures` | Same, in fixture mode (no server needed) |
| `npm run gen:types` | Regenerate `src/api/types.ts` and `src/api/schema-version.ts` from `backend/schemas` (commit the result) |
| `npx expo-doctor` | Project health; must be 21/21 |
| `npm run lint` | ESLint (`eslint.config.js`: the Expo flat config, which includes React's hook rules). Must be clean |

## Environment variables

`EXPO_PUBLIC_*` values are baked in when Metro bundles: restart Metro after changing them. Native settings
(`APP_VARIANT`, `WJRH_BUNDLE_ID`) are written into the generated `ios/`/`android/` folders by `expo prebuild`
(`expo run:ios` does it when the folder is missing), so re-run `npx expo prebuild --clean` after changing them.

| Variable | Effect |
|---|---|
| `APP_VARIANT=development` | Allows plain-HTTP to local addresses (iOS `NSAllowsLocalNetworking`, Android cleartext). Set by the `development` EAS profile; never for preview/production |
| `EXPO_PUBLIC_API_BASE` | API address. Default in dev: `http://127.0.0.1:8787`. Android emulator `http://10.0.2.2:8787`; a phone needs either the demo API on Cloudflare (`https://wjrh-api.anandenkhjin.workers.dev`, [`deployed-demo.md`](../../docs/backend-proposal/deployed-demo.md); no Mac needed) or the Mac's address on a network you trust (never campus Wi-Fi). Preview/production builds must set it; the station's own production API does not exist yet |
| `EXPO_PUBLIC_USE_FIXTURES=1` | Serve `src/api/fixtures` instead of calling the API |
| `EXPO_PUBLIC_DEMO_ARCHIVES=1` | **Demo only.** Shows the Archive tab with made-up recordings and placeholder covers for the real shows, to show the station board ([`archive-demo.md`](../../docs/mobile-app/archive-demo.md)). Also works in a Release build. Never set it in `eas.json` (a test checks) |
| `WJRH_BUNDLE_ID` | Overrides the placeholder bundle id / package `org.wjrh.app` (for signing with a personal Apple ID) |
| `EXPO_PUBLIC_AUTOPLAY=1` | **Dev only.** Press Play 4 s after launch |
| `EXPO_PUBLIC_DEV_OFFLINE=1` | **Dev only.** Makes the Now tab show its offline notice (the simulator can't be taken offline without cutting the Mac's network) |
| `EXPO_PUBLIC_DEV_ROUTE=/a,/b` | **Dev only.** Navigate to each route, 5 s apart, after launch (the simulator can't be tapped from automation, and a deep link from outside shows an iOS "Open in…?" dialog). `/a@600` also scrolls that screen 600 pt, and each settled screen logs `[dev-shot N]` for [`tools/design-compare`](../../tools/design-compare/README.md) |
| `EXPO_PUBLIC_DEV_NOW=2026-10-14T19:10:00-04:00` | **Dev only.** The schedule's clock, so "ON AIR NOW" can be seen at any hour (the player and API ignore it) |
| `EXPO_PUBLIC_DEV_ARCHIVE_PLAY=1` | **Dev only.** The first Archive page opened starts its newest sample episode by itself, so the playing state can be screenshotted |

The dev-only hooks are inert in release builds (`__DEV__` is false).

## Layout

| Path | What |
|---|---|
| `src/app/` | Expo Router routes only. `_layout.tsx` (providers, fonts, tabs), `(now)/` (Now, and `show/[showId]` opened from it), `schedule/`, `station/`, `archive/` (the demo; the tab is hidden unless `FEATURES.archive`) |
| `src/api/` | The API layer, below |
| `src/audio/` | The live player: `use-live-player.ts`, `live-player-provider.tsx`, `stall-watchdog.ts`, `audio-session.ts` |
| `src/archive/` | **Demo only:** the Archive demo's made-up data, sample descriptions, album-cover lookups and its pretend player ([`archive-demo.md`](../../docs/mobile-app/archive-demo.md)) |
| `src/screens/` | Screen bodies the routes render: `now/`, `schedule/`, `show/`, `station/`, `archive/`. Pure `*-state.ts` logic and tests live in Now, Schedule and Station; Show reuses Schedule logic, and Archive logic/tests live in `src/archive/` |
| `src/reminders/` | Show reminders: `plan.ts` (pure), `notifications.ts` (expo-notifications), `use-reminder.ts`, `reminders-provider.tsx` |
| `src/content/` | `station.ts`: the Station tab's static copy, page layout and links; `images.ts`: the bundled photos |
| `src/components/` | Shared UI: `tab-bar.tsx` (the design's tab bar), `player-dock.tsx`, `dock-metrics.ts` (room the floating docks need), `icons.tsx`, `logo.tsx`, `text.tsx` (`Text`, `DisplayText`), `focused-status-bar.tsx`; screen-specific pieces live beside their screen |
| `src/dev/` | Dev-only helpers (`dev-scroll.ts`); inert in release builds |
| `src/hooks/`, `src/utils/` | `use-now.ts`, `use-online.ts` (is the phone connected); `format-time.ts` (station-time formatting) |
| `src/config.ts` | `API_BASE`, built-in fallback stream URL, `DEMO_ARCHIVES` (`FEATURES.archive` mirrors it; real archives not built), dev hooks |
| `src/theme.ts` | The design's tokens: colors, fonts, gradients, and the display-font nudge. One palette, light only |
| `assets/` | Photos, the display font, icon, splash and notification icon; provenance in `assets/README.md` |
| `scripts/` | `gen-types.mjs`, `check-contract.mjs`, `smoke-api.ts` and their own `tsconfig.json` (Node, not React Native); `build-phone.sh` builds a signed Release app and installs it on a connected iPhone (header lists its settings) |
| `app.config.ts`, `eas.json` | App config (dev-only HTTP allowance, iOS 27 scene fix, bundle id) and EAS profiles `development` / `preview` / `production` |

## Now tab and live audio

| Path | What |
|---|---|
| `src/audio/use-live-player.ts` | The live player (`expo-audio`). Plays straight from the stream URL; never needs the API |
| `src/audio/live-player-provider.tsx` | One player for the whole app (playback survives tab switches); feeds lock-screen text from now-playing |
| `src/screens/now/` | The screen. `now-state.ts` is the pure "what do we say for this API answer" logic |

How the player behaves (the rules in `docs/mobile-app/plan.md`):

- **Never depends on the API.** With no `/v1/station` answer it plays the built-in `FALLBACK_STREAM_URL`;
  if the API's stream URL fails it switches to the fallback by itself, then retries with growing delays.
- **No rewinding.** Every Play (and every resume from outside the app) reconnects at the live edge, so a
  pause is never a way to replay the broadcast.
- **Recovers from stalls.** If playback is wanted but nothing is audible for 15 s (the connection dropped with no
  error event), a watchdog reconnects, waiting 15, 20, then 30 s between tries (`stall-watchdog.ts`, pure and
  unit-tested). The button shows "Reconnecting…" meanwhile.
- **Lock screen / Control Center:** title, artist, album from now-playing, flagged as a live stream (no
  scrub bar, no skip buttons).
- **Unknown is explicit:** `null` artist/title show "Artist metadata unavailable" / "Track title
  unavailable"; album is simply omitted until the encoder sends it; no upcoming songs, ever.
- It logs `[live] state=… fallback=…` to Metro in dev builds.

Verified on the simulator (Mac muted, so by state log and screenshots, not by ear): normal playback; the API's
stream URL dead (switched to the fallback and played); the whole API down (played, with the "Live audio still works"
notice). **Not verified, needs an iPhone:** how the lock screen looks, pausing/resuming from it (the resume path
reconnects at the live edge but has only been exercised in code), call interruptions, headphones, a long background run.

## Schedule, show pages and reminders

| Path | What |
|---|---|
| `src/app/schedule/` | The Schedule tab is a stack: `index` (the week) and `[showId]` (a show page) |
| `src/screens/schedule/` | One continuous week list with day bars and 24-hour times; opens at today, with an "ON AIR NOW" highlight. `schedule-state.ts` is the pure station-time logic |
| `src/screens/show/` | Show page: hosts, genres, when it airs, about (honest empty states for missing text), reminder button |
| `src/reminders/` | `plan.ts` (pure: which notifications to schedule), `notifications.ts` (expo-notifications), `reminders-provider.tsx` |

- **Station time.** "Today", "on air now" and every displayed time use America/New_York, wherever the phone is.
- **Reminders** ("remind me when this show starts") are local notifications, one per upcoming episode, planned
  from `/v1/schedule` for the next 28 days (cancelled episodes skipped, soonest 60 kept: iOS allows 64). They
  are re-planned each time the app opens or comes to the foreground; if the app is never opened for 4 weeks they
  run out. The scheduled notifications are the only record of which shows have a reminder (no storage).
  Tapping a reminder opens that show's page. Turning one on asks for notification permission first; if it was
  refused the button says how to turn it on in Settings.

Verified before #27 on the simulator: the week's list, scrolling to today's bar, a show page, and the schedule failing
to load (clear notice; pull down to retry). **Not verified, needs an iPhone:** the notification permission
prompt being accepted, a reminder arriving at the show's start, and tapping it. On the simulator iOS refuses to
schedule without permission and the prompt can't be tapped from automation, so only the planning logic
(unit-tested) and the permission state (`undetermined`, so a prompt would appear) were checked.

## Station tab

| Path | What |
|---|---|
| `src/app/station/` | A stack: `index` (the hub) and `[page]` (one page) |
| `src/content/station.ts` | The static copy (About, History, Get involved, Support, Contact), from the design |
| `src/screens/station/` | Hub, page renderer, and the API-backed Team and Events pages. `station-state.ts` is the pure logic |

- **Team respects `approved`.** `/v1/station` keeps `approved: false` until the station confirms the roster each
  semester. The roster has students' names and emails, so while it is `false` the Team page shows "Team list
  coming soon" and no names; the API also withholds the roster (`team: []`, `backend/api/src/content.ts`). Changing
  this policy requires updating both the API gate and `teamView` in `station-state.ts`. **Decision for the station to
  confirm:** whether events should also wait for approval; today they always show.
- **Events** are split into Upcoming and Event archive by station-time date, with a link to wjrh.org/events.
- **Static copy** was verified against wjrh.org on 21 Sep 2026 (`frontend/assets/station-content-sources.md`).
  Recheck before launch: board-meeting time, GroupMe invite, donation link.
- Links (email, phone, map, donation, socials, FCC file) open outside the app; failures are ignored quietly.

Verified on the simulator: the hub, Events (upcoming empty state + sorted archive), Contact, Team with the roster
not approved (hidden) and approved (list with email links; the approved run used a temporary local edit to
`backend/content/station.json`). Not verified: that tapping a link actually opens Mail / Phone / Safari.

## API layer (`src/api/`)

| File | What |
|---|---|
| `types.ts` | **Generated** from `backend/schemas/*.schema.json` (`npm run gen:types`). Never edit by hand; re-run and commit when the schemas change |
| `client.ts` | `apiGet<T>(path)`: timeout, error envelope -> `ApiError {status, code, message, requestId}`, no response -> `NetworkError`. Refuses `/admin/*` |
| `endpoints.ts` | One typed function per endpoint the app reads (no admin, no `/join`) |
| `queries.ts` | TanStack Query hooks with the plan's polling intervals; `isShowingStale(query)` is true when a refresh failed but older data is shown |
| `query-provider.tsx` | Query client; polling pauses when the app is backgrounded; retries network/5xx only; keeps the last good answers on the phone (below); refreshes what is on screen when the connection comes back |
| `cache-rules.ts` | Pure rules for the saved answers: which queries, how long, the cache key. Unit-tested |
| `schema-version.ts` | **Generated** hash of `backend/schemas`; part of the cache key, so a changed response shape discards old saved answers |
| `fixtures/` | Responses captured from the fake station, for offline UI work: `EXPO_PUBLIC_USE_FIXTURES=1` |

**Saved answers.** The last good station info, schedule, show list and now-playing answers are kept in
AsyncStorage (TanStack Query's persister), so a launch with no signal still has something to show. Station,
schedule and shows are used for up to 7 days; now-playing for 1 hour, and only as "last known": an answer saved by an
earlier run is hidden while a fresh one loads, so an old track is never shown as playing now
(`usableNowPlaying` in `src/screens/now/now-state.ts`). Health, recent tracks and archives are never saved. Live audio
does not read any of it. When the phone reports no connection, the Now tab says so
(`useIsOnline` in `src/hooks/use-online.ts`, built on NetInfo); queries are *not* paused when offline, so the other
screens keep showing their own "couldn't load" messages.

Not done yet: a fixture with archives (the recorder was not running when the fixtures were captured, so `archives.json`
and `show-archives.json` are empty). If the API's schemas change, the app's types and fixtures must follow: run
`npm run gen:types`, then `npm run check:contract`.

## Placeholders to replace

- Bundle ID / package `org.wjrh.app` (open question in the plan; fixed forever after the first store release).
- Icon, splash and the Android notification icon are my layout (the logo on the station maroon): replace them if the
  station has a brand kit. Outside demo mode, show and track artwork falls back to the station's collage until the station supplies art.
