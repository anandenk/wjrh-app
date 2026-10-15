import { Redirect, Stack } from 'expo-router';

import { FEATURES } from '@/config';
import { colors } from '@/theme';

// The Archive tab is a stack: the grid of shows, then one show's archive on top of it. The tab only appears in
// demo mode (FEATURES.archive in src/config.ts), and so do these routes: without it, opening one by a link
// (wjrh://archive) goes to Now instead of showing sample data. Screens draw their own headers, so the native header is off.
export default function ArchiveLayout() {
  if (!FEATURES.archive) return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.scheduleBg } }} />;
}
