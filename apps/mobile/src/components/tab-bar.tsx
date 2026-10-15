import { usePathname } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FEATURES } from '@/config';
import { colors, fonts } from '@/theme';

import { useReduceMotion } from './icons';
import { PlayerDock } from './player-dock';
import { Text } from './text';

// Route name -> the label the design prints. A route that is not listed is not a tab.
const LABELS: Record<string, string> = {
  '(now)': 'NOW',
  archive: 'ARCHIVE',
  schedule: 'SCHEDULE',
  station: 'STATION',
};

/**
 * The design's bottom chrome: the player dock on top (every screen except Now itself), then a flat tab bar of
 * plain text labels with a short maroon bar sliding along its top edge over the current one. Both float
 * over the screen, so screens leave room for them (dock-metrics.ts).
 */
export function AppTabBar({ state, navigation }: BottomTabBarProps) {
  const { bottom } = useSafeAreaInsets();
  const pathname = usePathname();

  const tabs = state.routes
    .map((route, i) => ({ route, i, label: LABELS[route.name] }))
    .filter((t) => t.label && (t.route.name !== 'archive' || FEATURES.archive));
  const focusedAt = Math.max(0, tabs.findIndex((t) => t.i === state.index));

  const reduceMotion = useReduceMotion();
  const [width, setWidth] = useState(0);
  const slot = tabs.length ? width / tabs.length : 0;
  const [x] = useState(() => new Animated.Value(0));
  useEffect(() => {
    // 340ms with the design's ease (cubic-bezier(0.4,0,0.2,1)).
    Animated.timing(x, {
      toValue: focusedAt * slot,
      duration: slot && !reduceMotion ? 340 : 0,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: true,
    }).start();
  }, [x, focusedAt, slot, reduceMotion]);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      {pathname === '/' ? null : <PlayerDock />}
      <View
        accessibilityRole="tablist"
        style={[styles.bar, { paddingBottom: Math.max(0, bottom - 14) }]}
        onLayout={onLayout}>
        {slot > 0 ? (
          <Animated.View pointerEvents="none" style={[styles.indicatorSlot, { width: slot, transform: [{ translateX: x }] }]}>
            <View style={styles.indicator} />
          </Animated.View>
        ) : null}
        {tabs.map(({ route, label }, n) => {
          const focused = n === focusedAt;
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          };
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityLabel={label.charAt(0) + label.slice(1).toLowerCase()}
              accessibilityState={{ selected: focused }}
              onPress={onPress}
              style={styles.tab}>
              <Text style={[styles.label, { color: focused ? colors.live : colors.ink3 }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  bar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.rim,
    backgroundColor: colors.surface,
  },
  tab: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 0.72 },
  // 3px tall, straddling the top border; the visible bar is 32px wide, centered in its slot.
  indicatorSlot: { position: 'absolute', top: -1, left: 0, height: 3, alignItems: 'center', zIndex: 2 },
  indicator: { width: 32, height: 3, backgroundColor: colors.live },
});
