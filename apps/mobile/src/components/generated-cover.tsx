import { StyleSheet } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { COVER_H, COVER_W, generateCover, type CoverShape } from '@/archive/demo-art';

function Shape({ s }: { s: CoverShape }) {
  switch (s.k) {
    case 'rect':
      return <Rect x={s.x} y={s.y} width={s.w} height={s.h} fill={s.fill} opacity={s.opacity} />;
    case 'circle':
      return (
        <Circle cx={s.cx} cy={s.cy} r={s.r} fill={s.fill ?? 'none'} stroke={s.stroke} strokeWidth={s.sw} opacity={s.opacity} />
      );
    case 'path':
      return <Path d={s.d} fill={s.fill ?? 'none'} stroke={s.stroke} strokeWidth={s.sw} opacity={s.opacity} />;
  }
}

/**
 * DEMO ONLY: original placeholder cover art, drawn from a seed (src/archive/demo-art.ts). Fills its parent and crops
 * to it, as a photo set to "cover" would.
 */
export function GeneratedCover({ seed }: { seed: string }) {
  const art = generateCover(seed);
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      viewBox={`0 0 ${COVER_W} ${COVER_H}`}
      preserveAspectRatio="xMidYMid slice"
      accessible={false}>
      <Rect width={COVER_W} height={COVER_H} fill={art.background} />
      {art.shapes.map((s, i) => (
        <Shape key={i} s={s} />
      ))}
    </Svg>
  );
}
