import { Stack } from 'expo-router';

import { colors } from '@/theme';

// The Station tab is a stack: the hub, then one page (About, Team, Events, ...).
// Screens draw their own headers, as in the design, so the native header is off.
export default function StationLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
}
