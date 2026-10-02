# WJRH mobile app (Expo)

The native iOS and Android listener app. **Scaffold, API layer and the Now tab.** Schedule, Station and Archive
are still placeholders.

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
