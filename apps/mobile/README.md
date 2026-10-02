# WJRH mobile app (Expo)

The native iOS and Android listener app. **Scaffold + API layer:** four placeholder tabs (Now, Schedule,
Archive, Station), build profiles, config, and the typed API layer. No real screens yet.

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
