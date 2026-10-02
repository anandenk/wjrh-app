# WJRH mobile app (Expo)

The native iOS and Android listener app. **Scaffold, API layer, Now tab, Schedule tab with show pages and
reminders, and the Station tab.** Archive is a hidden placeholder.

The stack, the screen-to-endpoint map, the licensing rules and the build order are in
[`docs/mobile-app/plan.md`](../../docs/mobile-app/plan.md). Audio spike results (library choice) are
in [`docs/mobile-app/audio-spike.md`](../../docs/mobile-app/audio-spike.md).

## Layout

| Path | What |
|---|---|
| `src/app/` | Expo Router routes only: `_layout.tsx` (tabs), `index`, `schedule`, `archive`, `station` |
| `src/api/` | The API layer, see below |
| `src/components/` | Reusable UI |
| `src/config.ts` | `API_BASE`, built-in fallback stream URL, feature flags (Archive is off) |
| `app.config.ts` | App config; dev-only plain-HTTP allowance for the local API |
| `eas.json` | Build profiles: `development` (simulator dev client), `preview`, `production` |

## Now tab and live audio

| Path | What |
|---|---|
| `src/audio/use-live-player.ts` | The live player (`expo-audio`). Plays straight from the stream URL; never needs the API |
| `src/audio/live-player-provider.tsx` | One player for the whole app (playback survives tab switches); feeds lock-screen text from now-playing |
| `src/screens/now/` | The screen. `now-state.ts` is the pure "what do we say for this API answer" logic (unit-tested) |

How the player behaves (the rules in `docs/mobile-app/plan.md`):

- **Never depends on the API.** With no `/v1/station` answer it plays the built-in `FALLBACK_STREAM_URL`;
  if the API's stream URL fails it switches to the fallback by itself, then retries with growing delays.
- **No rewinding.** Every Play (and every resume from outside the app) reconnects at the live edge, so a
  pause is never a way to replay the broadcast.
- **Lock screen / Control Center:** title, artist, album from now-playing, flagged as a live stream (no
  scrub bar, no skip buttons).
- **Unknown is explicit:** `null` artist/title show "Artist metadata unavailable" / "Track title
  unavailable"; album is simply omitted until the encoder sends it; no upcoming songs, ever.

Verified on the iOS 27 simulator (Mac muted, so by state log and screenshots, not by ear): normal
playback; the API's stream URL dead (switched to the fallback and played); the whole API down (played,
with the "Live audio still works" notice). **Not verified, needs an iPhone:** how the lock screen looks,
pausing/resuming from it (the resume path reconnects at the live edge but has only been exercised in
code), call interruptions, headphones, and a long background run.

Dev test hooks: `EXPO_PUBLIC_AUTOPLAY=1` (dev builds only) presses Play 4 s after launch; the player
logs `[live] state=… fallback=…` to Metro. `npm test` runs the unit tests.

## Schedule, show pages and reminders

| Path | What |
|---|---|
| `src/app/schedule/` | The Schedule tab is a stack: `index` (the week) and `[showId]` (a show page) |
| `src/screens/schedule/` | Day picker + the day's shows, "ON AIR NOW" highlight. `schedule-state.ts` is the pure station-time logic |
| `src/screens/show/` | Show page: hosts, genres, when it airs, about (honest empty states for missing text), reminder button |
| `src/reminders/` | `plan.ts` (pure: which notifications to schedule), `notifications.ts` (expo-notifications), `reminders-provider.tsx` |

- **Station time.** "Today", "on air now" and every displayed time use America/New_York, wherever the phone is.
- **Reminders** ("remind me when this show starts") are local notifications, one per upcoming episode, planned
  from `/v1/schedule` for the next 28 days (cancelled episodes skipped, soonest 60 kept: iOS allows 64). They
  are re-planned each time the app opens or comes to the foreground; if the app is never opened for 4 weeks they
  run out. The scheduled notifications are the only record of which shows have a reminder (no storage).
  Tapping a reminder opens that show's page. Turning one on asks for notification permission first; if it was
  refused the button says how to turn it on in Settings.

Verified on the iOS 27 simulator: the week's list with the right day marked today, a show page, and the
schedule failing to load (clear notice, day picker still works). **Not verified, needs an iPhone:** the
notification permission prompt being accepted, a reminder arriving at the show's start, and tapping it. On the
simulator iOS refuses to schedule without permission and the prompt can't be tapped from automation, so only the
planning logic (unit-tested) and the permission state (`undetermined`, so a prompt would appear) were checked.

Dev test hooks (dev builds only): `EXPO_PUBLIC_DEV_ROUTE=/schedule/supercut` (or a comma-separated list, 8 s apart) jumps to a route after launch
(a deep link from outside shows an iOS "Open in…?" dialog that can't be tapped in automated runs);
`EXPO_PUBLIC_DEV_REMINDER=<showId>` tries to schedule a reminder at launch and logs the result.

## Station tab

| Path | What |
|---|---|
| `src/app/station/` | A stack: `index` (the hub) and `[page]` (one page) |
| `src/content/station.ts` | The static copy (About, History, Get involved, Support, Contact), from the design |
| `src/screens/station/` | Hub, page renderer, and the API-backed Team and Events pages. `station-state.ts` is the pure logic |

- **Team respects `approved`.** `/v1/station` keeps `approved: false` until the station confirms the roster each
  semester. The roster has students' names and emails, so while it is `false` the Team page shows "Team list
  coming soon" and no names. (Easy to loosen: `teamView` in `station-state.ts`.) **Decision for the station to
  confirm:** whether events should also wait for approval; today they always show.
- **Events** are split into Upcoming and Event archive by station-time date, with a link to wjrh.org/events.
- **Static copy** was verified against wjrh.org on 21 Sep 2026 (`frontend/assets/station-content-sources.md`).
  Recheck before launch: board-meeting time, GroupMe invite, donation link. No photos yet (plan step 8).
- Links (email, phone, map, donation, socials, FCC file) open outside the app; failures are ignored quietly.

Verified on the iOS 27 simulator: the hub, Events (upcoming empty state + sorted archive), Contact, Team with the
roster not approved (hidden) and approved (list with email links). Not verified: that tapping a link actually
opens Mail / Phone / Safari (simulator limits), which is on the iPhone checklist.

## API layer (`src/api/`)

| File | What |
|---|---|
| `types.ts` | **Generated** from `backend/schemas/*.schema.json` (`npm run gen:types`). Never edit by hand; re-run and commit when the schemas change |
| `client.ts` | `apiGet<T>(path)`: timeout, error envelope -> `ApiError {status, code, message, requestId}`, no response -> `NetworkError`. Refuses `/admin/*` |
| `endpoints.ts` | One typed function per endpoint the app reads (no admin, no `/join`) |
| `queries.ts` | TanStack Query hooks with the plan's polling intervals; `isShowingStale(query)` is true when a refresh failed but older data is shown |
| `query-provider.tsx` | Query client; polling pauses when the app is backgrounded; retries network/5xx only |
| `fixtures/` | Responses captured from the fake station, for offline UI work: `EXPO_PUBLIC_USE_FIXTURES=1` |

Checks: `npm run check:contract` (fixtures still match the schemas), `npm run smoke:api` (needs
`backend/scripts/dev.sh` running; exercises the real client and validates every response),
`npm run smoke:fixtures` (same in fixture mode). Not done yet: persisting the last good answers
across app restarts (needs an async-storage persister), and a fixture with archives (the recorder
was not running when the fixtures were captured, so `archives.json` is empty).

## Run it (iOS Simulator)

```bash
backend/scripts/dev.sh                  # in another terminal: API on http://127.0.0.1:8787
cd apps/mobile && npm ci
APP_VARIANT=development npx expo run:ios   # builds a dev client and starts Metro
```

- Do **not** run Metro with `CI=1`: it stops watching files and serves a stale bundle.
- Xcode 27 has no Simulator app; open `/Applications/Xcode.app/Contents/Applications/DeviceHub.app`.
- `EXPO_PUBLIC_API_BASE` sets the API address (see the table in the plan for the Android emulator and
  physical phones). Preview and production builds must set it; the API is not deployed yet.
- `npm run typecheck` checks the code.

## Placeholders to replace

- Bundle ID / package `org.wjrh.app` (open question in the plan; fixed forever after the first store release).
- Icon and splash image are Expo's defaults (plan step 8 brings the WJRH logo and fonts).
