import type { ExpoConfig } from 'expo/config';

// EAS build profiles set APP_VARIANT (see eas.json). "development" allows plain-HTTP requests so
// the app can reach the local API (backend/scripts/dev.sh); preview and production use HTTPS only.
const isDev = process.env.APP_VARIANT === 'development';

// Placeholder identifier (an open question in docs/mobile-app/plan.md; permanent after the first store release).
// For testing on a phone with a personal Apple ID, override it without editing this file:
//   WJRH_BUNDLE_ID=com.yourname.wjrh npx expo prebuild --clean   (then build as usual)
const bundleId = process.env.WJRH_BUNDLE_ID ?? 'org.wjrh.app';

const config: ExpoConfig = {
  name: 'WJRH 104.9',
  slug: 'wjrh',
  scheme: 'wjrh',
  version: '1.0.0',
  orientation: 'portrait',
  // The design has one palette (cream and maroon) and no dark variant, so the app stays light.
  userInterfaceStyle: 'light',
  backgroundColor: '#F8E5BF',
  icon: './assets/icon.png', // the wordmark on the station maroon (assets/README.md)
  ios: {
    bundleIdentifier: bundleId,
    supportsTablet: false,
    infoPlist: {
      // Local-network HTTP (127.0.0.1, LAN) for the dev API only. Never in preview/production.
      ...(isDev ? { NSAppTransportSecurity: { NSAllowsLocalNetworking: true } } : {}),
    },
  },
  android: {
    package: bundleId,
    adaptiveIcon: {
      backgroundColor: '#861F2C',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    'expo-router',
    // Background playback + lock screen / Control Center controls for the live stream.
    // Local notifications for show reminders (no push server). Android needs a white-only small icon.
    ['expo-notifications', { icon: './assets/notification-icon.png', color: '#861F2C' }],
    ['expo-audio', { microphonePermission: false, recordAudioAndroid: false }],
    [
      'expo-splash-screen',
      { backgroundColor: '#861F2C', image: './assets/splash-icon.png', imageWidth: 200 },
    ],
    [
      'expo-build-properties',
      {
        // iOS 27 kills apps that don't use the UIScene lifecycle (SIGTRAP at launch).
        // Fixed by default in Expo SDK 58; remove this when upgrading.
        ios: { enableSceneSupport: true },
        android: { usesCleartextTraffic: isDev },
      },
    ],
  ],
  experiments: { typedRoutes: true, reactCompiler: true },
};

export default config;
