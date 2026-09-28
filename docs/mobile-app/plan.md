# Mobile app plan (Expo / React Native)

- **Status:** Proposed. Groundwork only; no app code yet.
- **Date:** 2026-09-28
- **Builds on:** the `/v1` API in [`backend/`](../../backend/), [Decision 001](../backend-proposal/decisions/001-hosting-on-cloudflare.md)
  (Cloudflare) and [Decision 002](../backend-proposal/decisions/002-archive-and-licensing.md) (Mixcloud archives).

The listener app is a native iOS and Android client built with Expo. It replaces the browser
design in `frontend/` as the thing listeners install. The design in `frontend/index.html` stays
the visual reference.

The app is **only a client**. Everything it knows about the station comes from the `/v1` API, with
two exceptions that go direct:
- live audio, from the stream URL in `/v1/station` (with a built-in fallback);
- Mixcloud archive playback, through Mixcloud's own player.

```
                   ┌──────────────── Expo app (apps/mobile) ────────────────┐
                   │  screens ─► query hooks ─► api client ─► fetch /v1/*   │
                   │  live player ─────────────────────────────────────────┼──► stream (direct)
                   │  archive player (WebView) ────────────────────────────┼──► Mixcloud widget
                   └────────────────────────────────────────────────────────┘
                                         │ /v1/*
                                         ▼
                   Cloudflare Worker (backend/api) ─► D1, cron, R2, Mixcloud lookup
```

## Repository layout

| Path | What |
|---|---|
| `apps/mobile/` | The Expo app. Empty until the build starts. |
| `backend/` | The `/v1` Worker, schemas, mocks, recorder (unchanged). |
| `backend/schemas/` | **Source of truth for the app's types.** The app generates TypeScript from these rather than hand-writing response shapes. |
| `frontend/` | The browser design. Visual reference and Cloudflare Pages preview. |

A workspace tool (npm workspaces or pnpm) is only worth adding if a shared package appears. Until
then `apps/mobile` and `backend/api` keep separate `package.json` files, as `backend/api` does now.

## Stack (proposed)

| Concern | Choice | Why |
|---|---|---|
| Framework | Expo, latest SDK at scaffold time, TypeScript | Managed native builds, OTA updates, no Xcode/Gradle upkeep for student maintainers |
| Navigation | Expo Router (tabs: Now, Schedule, Archive, Station; stack for show pages) | File-based routes match the design's screens |
| Server data | TanStack Query | Polling, caching, retry, stale state and offline persistence in one place |
| Types | Generated from `backend/schemas/*.json` (`json-schema-to-typescript`) | The contract tests already validate the API against these; the app reads the same contract |
| Live audio | `react-native-track-player` (fallback option: `expo-audio`) | Background playback, lock screen / Control Center / Android media notification, remote controls |
| Mixcloud archives | `react-native-webview` hosting Mixcloud's widget | Decision 002: audio must stay inside Mixcloud's player |
| Self-hosted archives (option 2, if chosen) | Same audio player as live, with seek | `audioUrl` supports HTTP Range |
| Config | `app.config.ts` + `EXPO_PUBLIC_API_BASE` per build profile | One place to point at local, staging or production |
| Builds | EAS Build (dev client, preview, production profiles) | Track player needs a development build, not Expo Go |
| Reminders | Local notifications (`expo-notifications`) scheduled from `/v1/schedule` | "Remind me when this show starts" without the push backend in the API proposal |

The two audio libraries are the one real choice to settle first. Build a throwaway spike that plays
the real stream in the background on one iPhone and one Android device, with lock-screen controls
and a phone-call interruption. Pick whichever passes.

## Screen → endpoint map

Follows [`api.md`](../backend-proposal/api.md#what-each-screen-of-the-design-reads).

| Screen | Endpoints | Poll / cache |
|---|---|---|
| Now: on-air show, LIVE/AUTOMATED, track | `/v1/now-playing` | 15 s while foregrounded; pause in background |
| Now: recently played | `/v1/recent?limit=20` | 30 s |
| Now: play button | stream URL from `/v1/station` → built-in fallback | n/a |
| Schedule | `/v1/schedule/weekly`, `/v1/schedule?from&to` | on focus; server sends `ETag` |
| Show page | `/v1/shows/:id`, `/v1/shows/:id/archives` | on focus |
| Archive grid | `/v1/archives` (respect `enabled: false`) | on focus |
| Station: team, events | `/v1/station` (respect `approved: false`) | daily |
| Offline / off-air banner | `/v1/health` → `services.stream.status` | 60 s |

Admin endpoints (`/v1/admin/*`) are **never** called from the listener app, and the admin token
must never be bundled into it.

## Rules the app must keep

From [`current-systems.md`](../backend-proposal/current-systems.md#licensing-rules-for-any-frontend):

- **No advance playlists.** Upcoming shows are fine; upcoming songs are not.
- **Show title, artist and album** while a track plays (album is `null` until the encoder sends it).
- **Non-interactive live stream:** no queue, no song picking, no per-track replay, no recording.
- **Mixcloud limits are Mixcloud's.** Our ±30 s buttons only ask the widget to seek; never route
  Mixcloud audio through our own player.

From the API contract:

- **Live audio never depends on the API.** Keep a built-in fallback stream URL. The prototype that
  proved this is kept at tag `archive/api-wired-design` (commit `e423e98`).
- **Keep the last good answer.** A failed poll shows stale data with a label, not a blank screen.
- `null` means unknown. Render an explicit empty state, never "TBD".
- Live and archive audio are mutually exclusive: starting one stops the other.

## Mixcloud in a native app

- `/v1/shows/:id/archives` returns `mixcloud.widgetUrl` for Mixcloud episodes and `audioUrl` for
  self-hosted ones. The app branches on which one is present.
- The widget is Mixcloud's web player loaded in a WebView. Control it (play, pause, seek ±30 s,
  progress) through the [Widget API](https://www.mixcloud.com/developers/widget/) using injected
  JavaScript and `postMessage`.
- Background playback and lock-screen controls for a WebView player are limited, especially on iOS.
  Test this early. If it's poor, "open in the Mixcloud app" is an acceptable fallback.
- **Before launch:** confirm Mixcloud's widget terms allow embedding in a station app (flagged in
  Decision 002).

## Local development against the backend

`backend/scripts/dev.sh` runs the API on `127.0.0.1:8787` against the fake station. A phone
can't reach the laptop's `127.0.0.1`:

| Device | `EXPO_PUBLIC_API_BASE` |
|---|---|
| iOS Simulator | `http://127.0.0.1:8787` |
| Android Emulator | `http://10.0.2.2:8787` |
| Physical phone (same Wi-Fi) | `http://<laptop LAN IP>:8787`, with `wrangler dev --ip 0.0.0.0` |

Dev builds need cleartext HTTP allowed (iOS ATS exception, Android `usesCleartextTraffic`) **in the
development profile only**. Production uses HTTPS everywhere. The real stream is already HTTPS.

CORS doesn't apply to native requests. It matters only if the app is also run as Expo web, in
which case the web origin must be added to `CORS_ORIGINS`.

## Build order (when building starts)

1. **Audio spike:** pick the live-audio library (see Stack).
2. **Scaffold:** `create-expo-app` in `apps/mobile`, Expo Router tabs, EAS profiles, env config.
3. **Contract layer:** generated types, a typed `fetch` client with the error envelope, query hooks,
   and fixtures from the fake station for offline UI work.
4. **Now tab:** live player, now-playing, recent, health banner. This is the first real milestone.
5. **Schedule and show pages**, plus local reminder notifications.
6. **Station tab.**
7. **Archive tab:** behind a flag until the board decides; Mixcloud WebView first.
8. Design polish from `frontend/`: the WJRH Display font (Barlow Condensed ExtraBold), the logo and
   station photos in `frontend/assets/`, an accessibility pass, store assets. Skip the `recent-cover-*`
   images: they are placeholder album art, and the feed has no artwork.

## Open questions

1. Who owns the Apple Developer ($99/yr) and Google Play ($25 once) accounts? They should belong to
   the station, not a student, like the Cloudflare account in Decision 001.
2. Bundle ID / package name (e.g. `org.wjrh.app`).
3. Minimum OS versions to support.
4. Is Expo web a target, or is `frontend/` on Cloudflare Pages the web presence?
5. Does the station want crash reporting (e.g. Sentry), given the privacy stance in `api.md`?
