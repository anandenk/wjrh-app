import { Stack } from 'expo-router';

import { colors } from '@/theme';

// The Schedule tab is a stack: the week's list, then a show's page on top of it.
// Screens draw their own headers, as in the design, so the native header is off.
export default function ScheduleLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.scheduleBg } }} />;
}
