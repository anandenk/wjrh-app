import { StyleSheet, Text as RNText, type TextProps } from 'react-native';

import { DISPLAY_NUDGE } from '@/theme';

/**
 * Text that follows the system text size, but only up to 130%. The design is built from fixed sizes and
 * heights; unlimited scaling would break the player dock, tab bar and schedule rows.
 */
export function Text(props: TextProps) {
  return <RNText maxFontSizeMultiplier={1.3} {...props} />;
}

/** Text in the display face ("WJRH Display"): same as Text, nudged down to sit where the design puts it (theme.ts). */
export function DisplayText({ style, ...props }: TextProps) {
  const size = StyleSheet.flatten(style)?.fontSize ?? 16;
  return <Text {...props} style={[style, { top: size * DISPLAY_NUDGE }]} />;
}
