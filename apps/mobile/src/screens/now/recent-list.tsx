import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import type { Recent } from '@/api/types';
import { Text } from '@/components/text';
import { IMAGES } from '@/content/images';
import { colors, fonts, gradients } from '@/theme';
import { formatStationTime } from '@/utils/format-time';

// The design puts each track's cover behind a dark gradient. The API has no cover for recent tracks, so every
// row shows a different slice of the station's own artwork instead (never another record's cover).
const slicePosition = (i: number) => ({ left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%` }) as const;

export function RecentList({ items }: { items: Recent['items'] }) {
  if (items.length === 0) {
    return <Text style={styles.empty}>Nothing played yet.</Text>;
  }
  return (
    <View>
      {items.map((t, i) => (
        <View key={t.id} style={styles.row}>
          <Image source={IMAGES.signal} contentFit="cover" contentPosition={slicePosition(i)} style={StyleSheet.absoluteFill} />
          <LinearGradient
            {...gradients.recentRow}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <View style={styles.text}>
            <Text style={[styles.title, shadow]} numberOfLines={1}>
              {t.title ?? 'Track title unavailable'}
            </Text>
            <Text style={[styles.artist, shadowSmall, !t.artist && styles.faint]} numberOfLines={1}>
              {t.artist ?? 'Artist metadata unavailable'}
            </Text>
          </View>
          <Text style={[styles.time, shadowSmall]}>{formatStationTime(t.startedAt)}</Text>
        </View>
      ))}
    </View>
  );
}

const shadow = { textShadowColor: colors.imageShadow, textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 8 };
const shadowSmall = { textShadowColor: colors.imageShadow, textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 7 };

const styles = StyleSheet.create({
  row: {
    minHeight: 78,
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    overflow: 'hidden',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.recentOutline,
    backgroundColor: colors.page,
  },
  text: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20, letterSpacing: -0.15, color: colors.onImage },
  artist: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, marginTop: 3, color: colors.onImageMuted },
  faint: { color: colors.onImageFaint },
  time: { fontFamily: fonts.bold, fontSize: 12, fontVariant: ['tabular-nums'], color: colors.onImageMuted },
  empty: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, marginTop: 8, color: colors.ink2 },
});
