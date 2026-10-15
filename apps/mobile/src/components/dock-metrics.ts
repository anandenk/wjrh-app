import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Sizes from the design: the tab bar's buttons are 46px tall plus a 1px top border, and the player dock is
// 8 + 44 + 8 of padding and controls plus its 1px border. Both sit above the home indicator, minus 14px
// (the design's `max(0px, safe-area - 14px)`).
const TAB_BAR_BASE = 47;
export const PLAYER_DOCK_HEIGHT = 61;

export function tabBarHeight(bottomInset: number): number {
  return TAB_BAR_BASE + Math.max(0, bottomInset - 14);
}

// The design's `.app-scroll` bottom padding is a fixed amount plus the full home-indicator inset, and it differs
// by screen: Now (no player dock) 78, the Station tab 152, Schedule and show pages 170 plus the 28 those pages
// add under their own content.
const SCROLL_PADDING = { now: 78, station: 152, other: 198 } as const;

/** How much room a scrolling screen must leave at the bottom for the docks that float over it. */
export function useBottomChrome(opts: { screen: keyof typeof SCROLL_PADDING }) {
  const { bottom } = useSafeAreaInsets();
  return { contentPadding: SCROLL_PADDING[opts.screen] + bottom };
}
