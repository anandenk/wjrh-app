import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';

import { useLivePlayerContext } from '@/audio/live-player-provider';

import type { DemoEpisode } from './demo-data';
import { initialPlayerState, playerReducer, type DemoPlayerState } from './demo-player-state';

type ArchivePlayer = DemoPlayerState & {
  /** Start an episode from the beginning (stops the live stream first). */
  play: (episode: DemoEpisode) => void;
  toggle: () => void;
  seekBy: (seconds: number) => void;
  seekTo: (seconds: number) => void;
  stop: () => void;
};

const Ctx = createContext<ArchivePlayer | null>(null);

const LOAD_MS = 700; // the pretend "loading" before an episode starts

/**
 * DEMO ONLY. The archive player for the sample episodes: a clock with a position, and no audio. It sits next to the
 * live player and keeps one rule from the plan: live and archive audio are mutually exclusive. Starting an episode
 * stops the live stream; pressing Play on the live stream ends the episode.
 */
export function ArchivePlayerProvider({ children }: { children: ReactNode }) {
  const live = useLivePlayerContext();
  const [state, dispatch] = useReducer(playerReducer, initialPlayerState);

  // An episode "loads" for a moment, then plays.
  useEffect(() => {
    if (state.status !== 'loading') return;
    const t = setTimeout(() => dispatch({ type: 'loaded' }), LOAD_MS);
    return () => clearTimeout(t);
  }, [state.status, state.episode]);

  // One second of listening per second.
  useEffect(() => {
    if (state.status !== 'playing') return;
    const t = setInterval(() => dispatch({ type: 'tick' }), 1000);
    return () => clearInterval(t);
  }, [state.status]);

  // The live stream starting (the listener pressed Play on Now or on the dock) ends the episode.
  const liveWasIdle = useRef(live.state === 'idle');
  useEffect(() => {
    const idle = live.state === 'idle';
    if (liveWasIdle.current && !idle) dispatch({ type: 'stop' });
    liveWasIdle.current = idle;
  }, [live.state]);

  const liveRef = useRef(live);
  useEffect(() => {
    liveRef.current = live;
  });

  const play = useCallback((episode: DemoEpisode) => {
    // Stop the live stream first (a toggle while it is on means pause), then start the episode.
    if (liveRef.current.state !== 'idle') liveRef.current.toggle();
    dispatch({ type: 'select', episode });
  }, []);
  const toggle = useCallback(() => dispatch({ type: 'toggle' }), []);
  const seekBy = useCallback((seconds: number) => dispatch({ type: 'seekBy', seconds }), []);
  const seekTo = useCallback((seconds: number) => dispatch({ type: 'seekTo', seconds }), []);
  const stop = useCallback(() => dispatch({ type: 'stop' }), []);

  const value = useMemo(
    () => ({ ...state, play, toggle, seekBy, seekTo, stop }),
    [state, play, toggle, seekBy, seekTo, stop],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useArchivePlayer(): ArchivePlayer {
  const v = useContext(Ctx);
  if (!v) throw new Error('useArchivePlayer must be used inside <ArchivePlayerProvider>');
  return v;
}
