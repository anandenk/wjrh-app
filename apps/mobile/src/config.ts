// One place for build-time settings. Set per EAS profile in eas.json, or in the shell for
// `npx expo start` (see README).

// Base URL of the /v1 API. 127.0.0.1 reaches the laptop from the iOS Simulator; Android Emulator
// needs http://10.0.2.2:8787 and a physical phone needs the laptop's LAN IP (docs/mobile-app/plan.md).
// Preview/production builds must set EXPO_PUBLIC_API_BASE: the API is not deployed yet.
export const API_BASE: string =
  process.env.EXPO_PUBLIC_API_BASE ?? (typeof __DEV__ !== 'undefined' && __DEV__ ? 'http://127.0.0.1:8787' : '');

// Live audio never depends on the API: if /v1/station is unreachable, play this directly.
export const FALLBACK_STREAM_URL = 'https://internetstreamer.lafayette.edu/';

// DEMO ONLY: show the Archive tab with made-up recordings and placeholder covers for the real shows, to pitch the
// idea to the station board (EXPO_PUBLIC_DEMO_ARCHIVES=1, baked in at bundle time, so it also works in a Release
// build). It must never be set for the preview or production profiles in eas.json (src/config.test.ts checks).
export const DEMO_ARCHIVES = process.env.EXPO_PUBLIC_DEMO_ARCHIVES === '1';

export const FEATURES = {
  // Real archives stay off until the station decides (docs/backend-proposal/decisions/002). The Archive tab appears
  // only in demo mode, with sample data from src/archive/.
  archive: DEMO_ARCHIVES,
};

// Offline UI work: serve src/api/fixtures instead of calling the API (EXPO_PUBLIC_USE_FIXTURES=1).
export const USE_FIXTURES = process.env.EXPO_PUBLIC_USE_FIXTURES === '1';

// Dev-only test hook: press Play automatically a few seconds after launch, so playback can be
// checked without tapping (EXPO_PUBLIC_AUTOPLAY=1). Ignored in release builds.
export const DEV_AUTOPLAY =
  typeof __DEV__ !== 'undefined' && __DEV__ && process.env.EXPO_PUBLIC_AUTOPLAY === '1';

// Dev-only test hook: make the app think the phone has no connection (EXPO_PUBLIC_DEV_OFFLINE=1), to see the
// offline notice. The simulator can't be taken offline without cutting the Mac's own network. Ignored in release builds.
export const DEV_OFFLINE =
  typeof __DEV__ !== 'undefined' && __DEV__ && process.env.EXPO_PUBLIC_DEV_OFFLINE === '1';

// Dev-only test hook: navigate to this route (or a comma-separated list, 8 s apart) after launch
// (EXPO_PUBLIC_DEV_ROUTE=/schedule/supercut). An entry can end in "@600" to scroll that screen to 600 px
// (dev/dev-scroll.ts), and each settled screen logs "[dev-shot N]" for screenshot scripts.
// because a deep link from outside the app shows an iOS "Open in…?" dialog that can't be tapped in automated runs.
export const DEV_ROUTE: string | undefined =
  typeof __DEV__ !== 'undefined' && __DEV__ ? process.env.EXPO_PUBLIC_DEV_ROUTE || undefined : undefined;

// Dev-only test hook: pretend it is this moment (EXPO_PUBLIC_DEV_NOW=2026-10-14T19:10:00-04:00) so the schedule's
// "ON AIR NOW" row can be seen at any hour. Only the schedule's clock; the live player and the API ignore it.
export const DEV_NOW: string | undefined =
  typeof __DEV__ !== 'undefined' && __DEV__ ? process.env.EXPO_PUBLIC_DEV_NOW || undefined : undefined;

// Dev-only test hook: the first Archive page opened starts its newest sample episode by itself
// (EXPO_PUBLIC_DEV_ARCHIVE_PLAY=1), because the simulator can't be tapped from automation. Ignored in release builds.
export const DEV_ARCHIVE_PLAY =
  typeof __DEV__ !== 'undefined' && __DEV__ && process.env.EXPO_PUBLIC_DEV_ARCHIVE_PLAY === '1';
