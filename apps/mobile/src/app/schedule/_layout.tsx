import { Stack } from 'expo-router';

// The Schedule tab is a stack: the week's list, then a show's page on top of it.
export default function ScheduleLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Schedule', headerLargeTitle: true }} />
      <Stack.Screen name="[showId]" options={{ title: '', headerBackTitle: 'Schedule' }} />
    </Stack>
  );
}
