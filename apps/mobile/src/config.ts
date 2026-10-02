// One place for build-time settings. Set per EAS profile in eas.json, or in the shell for
// `npx expo start` (see README).

// Base URL of the /v1 API. 127.0.0.1 reaches the laptop from the iOS Simulator; Android Emulator
// needs http://10.0.2.2:8787 and a physical phone needs the laptop's LAN IP (docs/mobile-app/plan.md).
// Preview/production builds must set EXPO_PUBLIC_API_BASE: the API is not deployed yet.
export const API_BASE: string =
  process.env.EXPO_PUBLIC_API_BASE ?? (__DEV__ ? 'http://127.0.0.1:8787' : '');

// Live audio never depends on the API: if /v1/station is unreachable, play this directly.
export const FALLBACK_STREAM_URL = 'https://internetstreamer.lafayette.edu/';

export const FEATURES = {
  // Archives stay off until the station decides (docs/backend-proposal/decisions/002).
  archive: false,
};
