import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { useReminder } from '@/reminders/use-reminder';
import { colors, fonts } from '@/theme';

/** "Remind me when it starts": a cream pill on the maroon page, gold once it is on. */
export function ReminderButton({ showId, showName }: { showId: string; showName: string }) {
  const { enabled, busy, result, toggle } = useReminder(showId);
  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="switch"
        accessibilityLabel={`Remind me when ${showName} starts`}
        accessibilityState={{ checked: enabled, busy }}
        disabled={busy}
        onPress={toggle}
        style={({ pressed }) => [styles.button, enabled && styles.buttonOn, pressed && styles.pressed]}>
        <Text style={[styles.label, enabled && styles.labelOn]}>
          {busy ? 'Working…' : enabled ? 'Reminder on' : 'Remind me when it starts'}
        </Text>
      </Pressable>
      {result === 'denied' ? (
        <Text style={styles.note} onPress={() => void Linking.openSettings()}>
          Notifications are off for WJRH. Tap here to turn them on in Settings.
        </Text>
      ) : null}
      {result === 'error' ? (
        <Text style={styles.note}>Couldn&apos;t set the reminder. Check your connection and try again.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 16, paddingHorizontal: 20, gap: 10, alignItems: 'flex-start' },
  button: {
    minHeight: 48,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: colors.accentInk,
  },
  buttonOn: { backgroundColor: colors.logoGold },
  pressed: { opacity: 0.78 },
  label: { fontFamily: fonts.bold, fontSize: 13, color: colors.live },
  labelOn: { color: colors.ink },
  note: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.onImageMuted },
});
