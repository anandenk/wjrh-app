# WJRH mobile app (Expo)

The native iOS and Android listener app. **Scaffold only:** four placeholder tabs (Now, Schedule,
Archive, Station), build profiles and config. No real screens yet.

The stack, the screen-to-endpoint map, the licensing rules and the build order are in
[`docs/mobile-app/plan.md`](../../docs/mobile-app/plan.md). Audio spike results (library choice) are
in [`docs/mobile-app/audio-spike.md`](../../docs/mobile-app/audio-spike.md).

## Layout

| Path | What |
|---|---|
| `src/app/` | Expo Router routes only: `_layout.tsx` (tabs), `index`, `schedule`, `archive`, `station` |
| `src/components/` | Reusable UI |
| `src/config.ts` | `API_BASE`, built-in fallback stream URL, feature flags (Archive is off) |
| `app.config.ts` | App config; dev-only plain-HTTP allowance for the local API |
| `eas.json` | Build profiles: `development` (simulator dev client), `preview`, `production` |

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
