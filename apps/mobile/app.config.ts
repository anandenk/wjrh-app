import type { ExpoConfig } from 'expo/config';

// EAS build profiles set APP_VARIANT (see eas.json). "development" allows plain-HTTP requests so
// the app can reach the local API (backend/scripts/dev.sh); preview and production use HTTPS only.
const isDev = process.env.APP_VARIANT === 'development';

const config: ExpoConfig = {
  name: 'WJRH 104.9',
  slug: 'wjrh',
  scheme: 'wjrh',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  icon: './assets/icon.png', // placeholder (Expo default); real branding is plan step 8
  ios: {
    // Placeholder: the bundle ID is an open question in docs/mobile-app/plan.md. It cannot
    // change after the first store release, so settle it before submitting.
    bundleIdentifier: 'org.wjrh.app',
    supportsTablet: false,
    infoPlist: {
      // Local-network HTTP (127.0.0.1, LAN) for the dev API only. Never in preview/production.
      ...(isDev ? { NSAppTransportSecurity: { NSAllowsLocalNetworking: true } } : {}),
    },
  },
  android: {
    package: 'org.wjrh.app', // placeholder, same open question as the iOS bundle ID
    adaptiveIcon: {
      backgroundColor: '#E6F4FE',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    'expo-router',
    // Background playback + lock screen / Control Center controls for the live stream.
    // Local notifications for show reminders (no push server).
    'expo-notifications',
    ['expo-audio', { microphonePermission: false, recordAudioAndroid: false }],
    [
      'expo-splash-screen',
      { backgroundColor: '#F8E5BF', image: './assets/splash-icon.png', imageWidth: 76 },
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
