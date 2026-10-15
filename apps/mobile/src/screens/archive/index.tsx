import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { DemoArchiveShow } from '@/archive/demo-data';
import { useArchiveCatalog } from '@/archive/use-archive';
import { ShowCover } from '@/components/album-cover';
import { useBottomChrome } from '@/components/dock-metrics';
import { FocusedStatusBar } from '@/components/focused-status-bar';
import { DisplayText, Text } from '@/components/text';
import { colors, fonts, gradients } from '@/theme';

const GAP = 2;

/** The Archive tab: a two-column grid of the shows, each with a (placeholder) cover. Demo data only. */
export function ArchiveScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const chrome = useBottomChrome({ screen: 'other' });
  const catalog = useArchiveCatalog();
  const tile = Math.floor((width - GAP) / 2);

  const renderTile = ({ item }: { item: DemoArchiveShow }) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open broadcast history for ${item.name}`}
      onPress={() => router.push(`/archive/${item.showId}`)}
      style={({ pressed }) => [{ width: tile, height: tile }, styles.tile, pressed && { opacity: 0.88 }]}>
      <ShowCover slot={item.coverSlot} style={StyleSheet.absoluteFill} />
      <LinearGradient {...gradients.tile} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={styles.copy} pointerEvents="none">
        <DisplayText style={styles.show} numberOfLines={2}>
          {item.name}
        </DisplayText>
        {item.hosts ? (
          <Text style={styles.host} numberOfLines={1}>
            With {item.hosts}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );

  return (
    <View style={styles.root}>
      <FocusedStatusBar style="light" />
      <View style={[styles.masthead, { paddingTop: 24 + insets.top }]}>
        <DisplayText style={styles.title} accessibilityRole="header">
          Archive
        </DisplayText>
        <Text style={styles.subtitle}>Past shows</Text>
      </View>
      <FlatList
        data={catalog.shows}
        keyExtractor={(s) => s.showId}
        numColumns={2}
        renderItem={renderTile}
        columnWrapperStyle={{ gap: GAP }}
        ItemSeparatorComponent={() => <View style={{ height: GAP }} />}
        contentContainerStyle={{ paddingBottom: chrome.contentPadding }}
        contentInsetAdjustmentBehavior="never"
        ListEmptyComponent={
          <Text style={styles.status}>
            {catalog.isLoading ? 'Loading…' : catalog.isError ? "Can't load the shows right now." : 'No shows yet.'}
          </Text>
        }
        ListFooterComponent={
          catalog.shows.length ? (
            <Text style={styles.note}>
              Live show list from the WJRH calendar · album covers are placeholders · broadcast history is sample data.
            </Text>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.scheduleBg },
  masthead: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.onImageFaint,
    backgroundColor: colors.scheduleBg,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 42,
    lineHeight: 42,
    letterSpacing: 0.42,
    textTransform: 'uppercase',
    color: colors.accentInk,
  },
  subtitle: {
    marginTop: 8,
    fontFamily: fonts.bold,
    fontSize: 11,
    lineHeight: 11,
    letterSpacing: 0.99,
    textTransform: 'uppercase',
    color: colors.onImageMuted,
  },
  tile: { overflow: 'hidden', backgroundColor: colors.surface2 },
  copy: { position: 'absolute', left: 12, right: 12, bottom: 12 },
  show: {
    fontFamily: fonts.display,
    fontSize: 20,
    lineHeight: 20.4,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
    color: colors.onImage,
    textShadowColor: colors.imageShadow,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 10,
  },
  host: {
    marginTop: 8,
    fontFamily: fonts.bold,
    fontSize: 10,
    lineHeight: 10,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: colors.onImageMuted,
    textShadowColor: colors.imageShadow,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  status: { padding: 20, fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.onImageMuted },
  note: {
    paddingHorizontal: 20,
    paddingTop: 16,
    fontFamily: fonts.body,
    fontSize: 10,
    lineHeight: 14.5,
    color: colors.onImageMuted,
  },
});
