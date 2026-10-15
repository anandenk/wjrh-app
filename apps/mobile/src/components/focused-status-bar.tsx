import { useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

/**
 * The status bar text color for a screen. Tab screens stay mounted when you leave them, so only the
 * focused one may set it. "light" = light text, for dark backgrounds (photos, the maroon screens).
 */
export function FocusedStatusBar({ style }: { style: 'light' | 'dark' }) {
  return useIsFocused() ? <StatusBar style={style} /> : null;
}
