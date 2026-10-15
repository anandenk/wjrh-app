import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Tabs } from 'expo-router/js-tabs';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { QueryProvider } from '@/api/query-provider';
import { ArchivePlayerProvider } from '@/archive/archive-player-provider';
import { LivePlayerProvider } from '@/audio/live-player-provider';
import { prefetchDemoCovers } from '@/components/album-cover';
import { AppTabBar } from '@/components/tab-bar';
import { DEMO_ARCHIVES } from '@/config';
import { RemindersProvider } from '@/reminders/reminders-provider';
import { colors } from '@/theme';

// Keep the splash screen up until the fonts are ready, so no screen flashes in the system font.
void SplashScreen.preventAutoHideAsync();

// Four tabs, in the design's order. The route files are src/app/(now)/, schedule/, archive/ and station/;
// the tab bar itself is src/components/tab-bar.tsx (Archive stays hidden while FEATURES.archive is off).
export default function TabLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    WJRHDisplay: require('../../assets/fonts/barlow-condensed-extrabold.ttf'),
  });
  const ready = fontsLoaded || fontError != null; // a font that fails to load must not block the app
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);
  // Demo only: fetch the album covers once, so they are on the phone for a demo with no signal.
  useEffect(() => {
    if (DEMO_ARCHIVES) prefetchDemoCovers();
  }, []);
  if (!ready) return null;

  return (
    <QueryProvider>
      <LivePlayerProvider>
        <ArchivePlayerProvider>
          <RemindersProvider>
            <Tabs
              tabBar={(props) => <AppTabBar {...props} />}
              screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}>
              <Tabs.Screen name="(now)" />
              <Tabs.Screen name="archive" />
              <Tabs.Screen name="schedule" />
              <Tabs.Screen name="station" />
            </Tabs>
          </RemindersProvider>
        </ArchivePlayerProvider>
      </LivePlayerProvider>
    </QueryProvider>
  );
}
