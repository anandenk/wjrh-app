import { useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts } from '@/theme';

import { ChevronLeft } from './icons';
import { DisplayText, Text } from './text';

/**
 * The header of a page opened from a list (a show, an archive): Back with where it goes, the page's label in the
 * display face, and the frequency. `fallback` is where Back goes when there is nothing to go back to.
 */
export function DetailHeader({ backLabel, title, fallback }: { backLabel: string; title: string; fallback: Href }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const goBack = () => (router.canGoBack() ? router.back() : router.replace(fallback));
  return (
    <View style={[styles.header, { paddingTop: 8 + insets.top }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Back to ${backLabel.charAt(0) + backLabel.slice(1).toLowerCase()}`}
        onPress={goBack}
        hitSlop={{ right: 12 }}
        style={({ pressed }) => [styles.back, pressed && { opacity: 0.78 }]}>
        <ChevronLeft size={16} color={colors.accentInk} />
        <Text style={styles.backText}>{backLabel}</Text>
      </Pressable>
      <DisplayText style={styles.title}>{title}</DisplayText>
      <Text style={styles.frequency}>104.9 FM</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 60,
    paddingBottom: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.onImageFaint,
    backgroundColor: colors.scheduleBg,
  },
  back: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 8 },
  backText: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 11, letterSpacing: 0.77, color: colors.accentInk },
  title: { fontFamily: fonts.display, fontSize: 24, lineHeight: 24, letterSpacing: 0.24, color: colors.accentInk },
  frequency: {
    flex: 1,
    textAlign: 'right',
    fontFamily: fonts.bold,
    fontSize: 10,
    lineHeight: 10,
    letterSpacing: 0.6,
    color: colors.onImageMuted,
  },
});
