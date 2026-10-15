import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { colors } from '@/theme';

import { WJRH_LOGO_ASPECT, WJRH_LOGO_XML } from './wjrh-logo-xml';

/** The gold WJRH wordmark on its maroon plate (the design's .station-logo-wrap / .now-live-logo). */
export function Logo({ width = 126 }: { width?: number }) {
  const inner = width - 20; // 10px of padding each side
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="WJRH 104.9 FM"
      style={{
        width,
        paddingTop: 8,
        paddingHorizontal: 10,
        paddingBottom: 7,
        borderRadius: 4,
        backgroundColor: colors.live,
      }}>
      <SvgXml xml={WJRH_LOGO_XML} width={inner} height={inner / WJRH_LOGO_ASPECT} />
    </View>
  );
}
