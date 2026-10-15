import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, View } from 'react-native';
import Svg, { Path, Polygon } from 'react-native-svg';

// The design's icons, drawn from the same shapes (frontend/index.html). Colors come from the caller
// (`color`), the way CSS `currentColor` did.

/** True when the system asks for less motion. */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => live && setReduce(v));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

/** The play triangle. `now` is the big one on the Now hero; `dock` the small one in the player dock. */
export function PlayTriangle({ size, color, variant = 'dock' }: { size: number; color: string; variant?: 'now' | 'dock' }) {
  return variant === 'now' ? (
    <Svg width={size} height={size} viewBox="0 0 54 54" fill={color}>
      <Polygon points="13.5,6 13.5,48 54,27" />
    </Svg>
  ) : (
    <Svg width={size} height={size} viewBox="0 0 42 42" fill={color}>
      <Polygon points="5,4 5,38 37,21" />
    </Svg>
  );
}

/** The stop square the design shows while the live stream plays (live radio has stop, not pause). */
export function StopSquare({ size, color }: { size: number; color: string }) {
  return <View style={{ width: size, height: size, backgroundColor: color }} />;
}

/** A ring with one bright quarter that turns: "connecting". */
export function Spinner({
  size,
  thickness,
  color,
  track,
}: {
  size: number;
  thickness: number;
  color: string;
  track: string;
}) {
  const [turn] = useState(() => new Animated.Value(0));
  const reduce = useReduceMotion();
  useEffect(() => {
    turn.setValue(0);
    // The design slows the spinner (it never stops) when the system asks for reduced motion.
    const loop = Animated.loop(
      Animated.timing(turn, { toValue: 1, duration: reduce ? 1400 : 680, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [turn, reduce]);
  const rotate = turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: thickness,
        borderColor: track,
        borderTopColor: color,
        transform: [{ rotate }],
      }}
    />
  );
}

const STROKE = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export function ChevronLeft({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...STROKE} stroke={color}>
      <Path d="m15 18-6-6 6-6" />
    </Svg>
  );
}

export function ChevronRight({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...STROKE} stroke={color}>
      <Path d="m9 18 6-6-6-6" />
    </Svg>
  );
}

export function ExternalLinkIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" {...STROKE} stroke={color}>
      <Path d="M14 3h7v7" />
      <Path d="M10 14 21 3" />
      <Path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
    </Svg>
  );
}

export function InstagramGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        fill={color}
        fillRule="evenodd"
        clipRule="evenodd"
        d="M3 8a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V8Zm5-3a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3H8Zm7.597 2.214a1 1 0 0 1 1-1h.01a1 1 0 1 1 0 2h-.01a1 1 0 0 1-1-1ZM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm-5 3a5 5 0 1 1 10 0 5 5 0 0 1-10 0Z"
      />
    </Svg>
  );
}

export function FacebookGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M14 8h3V4h-3c-3.3 0-5 2-5 5v3H6v4h3v6h4v-6h3l1-4h-4V9c0-.7.3-1 1-1Z" />
    </Svg>
  );
}

export function TwitterGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M22 5.892a8.178 8.178 0 0 1-2.355.635 4.074 4.074 0 0 0 1.8-2.235 8.343 8.343 0 0 1-2.605.981A4.13 4.13 0 0 0 15.85 4a4.068 4.068 0 0 0-4.1 4.038c0 .31.035.618.105.919A11.705 11.705 0 0 1 3.4 4.734a4.006 4.006 0 0 0 1.268 5.392 4.165 4.165 0 0 1-1.859-.5v.05A4.057 4.057 0 0 0 6.1 13.635a4.192 4.192 0 0 1-1.856.07 4.108 4.108 0 0 0 3.831 2.807A8.36 8.36 0 0 1 2 18.184 11.732 11.732 0 0 0 8.291 20 11.502 11.502 0 0 0 19.964 8.5c0-.177 0-.349-.012-.523A8.143 8.143 0 0 0 22 5.892Z"
      />
    </Svg>
  );
}
