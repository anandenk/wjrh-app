import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { useReminder } from '@/reminders/use-reminder';
import { colors } from '@/theme';

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
          {busy ? 'Working…' : enabled ? '🔔 Reminder on' : 'Remind me when it starts'}
        </Text>
      </Pressable>
      {result === 'denied' ? (
        <Text style={styles.note} onPress={() => void Linking.openSettings()}>
          Notifications are off for WJRH. Tap here to turn them on in Settings.
        </Text>
      ) : null}
      {result === 'error' ? (
        <Text style={styles.note}>Couldn't set the reminder. Check your connection and try again.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  button: {
    alignSelf: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.live,
  },
  buttonOn: { backgroundColor: colors.live },
  pressed: { opacity: 0.8 },
  label: { fontSize: 16, fontWeight: '700', color: colors.live },
  labelOn: { color: colors.onImage },
  note: { fontSize: 13, color: colors.ink2 },
});
