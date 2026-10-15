import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';

import { useNowPlaying, useStation } from '@/api/queries';
import { DEV_AUTOPLAY } from '@/config';

import { useLivePlayer } from './use-live-player';

type LivePlayer = ReturnType<typeof useLivePlayer>;
const Ctx = createContext<LivePlayer | null>(null);

/**
 * One live player for the whole app, so playback survives switching tabs. It reads the API only for
 * lock-screen text and the stream URL, and works without either.
 */
export function LivePlayerProvider({ children }: { children: ReactNode }) {
  const station = useStation();
  const nowPlaying = useNowPlaying();
  const np = nowPlaying.data;

  const metadata = useMemo(() => {
    const show = np?.show;
    const hosts = show?.hostNames.join(', ');
    return {
      title: np?.track?.title ?? show?.name ?? 'WJRH 104.9 FM',
      artist: np?.track?.artist ?? (hosts ? `with ${hosts}` : 'Live on WJRH 104.9 FM'),
      albumTitle: np?.track?.album ?? show?.name ?? 'WJRH 104.9 FM',
    };
  }, [np]);

  const player = useLivePlayer({ streamUrl: station.data?.listen.streamUrl, metadata });

  // Dev-only: log state changes (visible in Metro) and optionally auto-press Play for testing.
  useEffect(() => {
    if (__DEV__) console.log(`[live] state=${player.state} fallback=${player.usingFallback}`);
  }, [player.state, player.usingFallback]);
  useEffect(() => {
    if (!DEV_AUTOPLAY) return;
    const t = setTimeout(player.toggle, 4000);
    return () => clearTimeout(t);
    // Dev-only hook: press Play once after launch, not again when the player object changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <Ctx.Provider value={player}>{children}</Ctx.Provider>;
}

export function useLivePlayerContext(): LivePlayer {
  const v = useContext(Ctx);
  if (!v) throw new Error('useLivePlayerContext must be used inside <LivePlayerProvider>');
  return v;
}
