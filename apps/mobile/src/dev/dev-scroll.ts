import { useEffect, type RefObject } from 'react';
import type { ScrollView } from 'react-native';

// Dev-only helper for the simulator, which cannot be scrolled from automation. The EXPO_PUBLIC_DEV_ROUTE hook
// (config.ts) can give a route a scroll offset ("/station/about@600"); screens that call useDevScroll then
// scroll to it. Nothing here runs in release builds (__DEV__ is false).

let pendingY = 0;
const listeners = new Set<(y: number) => void>();

/** Called by the route hook after it navigates. No offset (0) means "leave the screen where it opens". */
export function devScrollTo(y: number): void {
  pendingY = y;
  if (y) listeners.forEach((l) => l(y)); // a 0 would scroll an already-open screen (such as Schedule at today) back to the top
}

/** Scroll this ScrollView to the offset the route hook asked for, once the screen has laid out. */
export function useDevScroll(ref: RefObject<ScrollView | null>): void {
  useEffect(() => {
    if (!__DEV__) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const go = (y: number) => {
      timers.push(setTimeout(() => ref.current?.scrollTo({ y, animated: false }), 1200));
    };
    if (pendingY) go(pendingY);
    listeners.add(go);
    return () => {
      listeners.delete(go);
      timers.forEach(clearTimeout);
    };
  }, [ref]);
}
