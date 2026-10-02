import { Stack } from 'expo-router';

// The Station tab is a stack: the hub, then one page (About, Team, Events, ...).
export default function StationLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Station', headerLargeTitle: true }} />
      <Stack.Screen name="[page]" options={{ title: '', headerBackTitle: 'Station' }} />
    </Stack>
  );
}
