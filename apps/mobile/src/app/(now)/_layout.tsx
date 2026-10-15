import { Stack } from 'expo-router';

import { colors } from '@/theme';

// The Now tab is a stack: Now itself, then a show's page on top of it (tap the show's name).
// Screens draw their own headers, as in the design, so the native header is off.
export default function NowLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
}
