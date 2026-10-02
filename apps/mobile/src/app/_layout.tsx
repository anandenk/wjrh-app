import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { QueryProvider } from '@/api/query-provider';
import { LivePlayerProvider } from '@/audio/live-player-provider';
import { FEATURES } from '@/config';
import { RemindersProvider } from '@/reminders/reminders-provider';

// Four tabs, as in docs/mobile-app/plan.md. The route files are src/app/{index,archive,station}.tsx and src/app/schedule/.
export default function TabLayout() {
  return (
    <QueryProvider>
      <LivePlayerProvider>
        <RemindersProvider>
          <NativeTabs>
            <NativeTabs.Trigger name="index">
              <NativeTabs.Trigger.Label>Now</NativeTabs.Trigger.Label>
              <NativeTabs.Trigger.Icon sf="dot.radiowaves.left.and.right" md="radio" />
            </NativeTabs.Trigger>
            <NativeTabs.Trigger name="schedule">
              <NativeTabs.Trigger.Label>Schedule</NativeTabs.Trigger.Label>
              <NativeTabs.Trigger.Icon sf="calendar" md="calendar_month" />
            </NativeTabs.Trigger>
            <NativeTabs.Trigger name="archive" hidden={!FEATURES.archive}>
              <NativeTabs.Trigger.Label>Archive</NativeTabs.Trigger.Label>
              <NativeTabs.Trigger.Icon sf="archivebox" md="inventory_2" />
            </NativeTabs.Trigger>
            <NativeTabs.Trigger name="station">
              <NativeTabs.Trigger.Label>Station</NativeTabs.Trigger.Label>
              <NativeTabs.Trigger.Icon sf="info.circle" md="info" />
            </NativeTabs.Trigger>
          </NativeTabs>
        </RemindersProvider>
      </LivePlayerProvider>
    </QueryProvider>
  );
}
