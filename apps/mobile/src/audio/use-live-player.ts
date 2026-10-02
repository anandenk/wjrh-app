import { useAudioPlayer, useAudioPlayerStatus, type AudioMetadata } from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';

import { FALLBACK_STREAM_URL } from '@/config';

import { configureAudioSession } from './audio-session';

/**
 * idle: not playing. connecting: waiting for audio. playing: audible.
 * reconnecting: playback failed; trying again (and using the built-in stream URL if needed).
 */
export type LiveState = 'idle' | 'connecting' | 'playing' | 'reconnecting';

const RETRY_DELAYS_MS = [2_000, 5_000, 10_000, 20_000];
// After the user pauses, ignore "player is playing" for a moment: the status lags the pause call.
const PAUSE_SETTLE_MS = 2_000;

type Options = {
  /** Stream URL from /v1/station. Optional: without it (API down) the built-in URL is used. */
  streamUrl: string | undefined;
  /** Shown on the lock screen / Control Center. */
  metadata: AudioMetadata;
};

/**
 * Plays the live stream straight from its URL. It never depends on the API: with no `streamUrl`, or
 * if that URL fails, it plays FALLBACK_STREAM_URL. Every play reconnects at the live edge, so a pause
 * never turns into rewinding the broadcast (no replay, per the licensing rules).
 */
export function useLivePlayer({ streamUrl, metadata }: Options) {
  // No source at load time: we choose and (re)load the source ourselves in begin().
  const player = useAudioPlayer(null, { updateInterval: 1000, keepAudioSessionActive: true });
  const status = useAudioPlayerStatus(player);

  const [wantPlaying, setWantPlaying] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);
  const [retryTick, setRetryTick] = useState(0);

  const wantRef = useRef(false);
  const fallbackRef = useRef(false);
  const attemptsRef = useRef(0);
  const startedRef = useRef(false); // has this attempt produced audio yet?
  const lockActiveRef = useRef(false);
  const ignorePlayingUntil = useRef(0);
  const streamUrlRef = useRef(streamUrl);
  streamUrlRef.current = streamUrl;
  const metadataRef = useRef(metadata);
  metadataRef.current = metadata;

  const currentUri = () =>
    fallbackRef.current || !streamUrlRef.current ? FALLBACK_STREAM_URL : streamUrlRef.current;

  /** (Re)connect at the live edge and play. */
  const begin = useCallback(() => {
    startedRef.current = false;
    player.replace({ uri: currentUri() });
    player.play();
    player.setActiveForLockScreen(true, metadataRef.current, {
      isLiveStream: true,
      showSeekBackward: false,
      showSeekForward: false,
    });
    lockActiveRef.current = true;
  }, [player]);

  const setWant = (v: boolean) => {
    wantRef.current = v;
    setWantPlaying(v);
  };

  const play = useCallback(async () => {
    attemptsRef.current = 0;
    setWant(true);
    try {
      await configureAudioSession();
    } catch {
      // Keep going: playing in the foreground still works.
    }
    begin();
  }, [begin]);

  const pause = useCallback(() => {
    ignorePlayingUntil.current = Date.now() + PAUSE_SETTLE_MS;
    setWant(false);
    player.pause();
  }, [player]);

  const toggle = useCallback(() => (wantRef.current ? pause() : void play()), [pause, play]);

  // Track what the player is doing.
  useEffect(() => {
    if (status.playing && !status.error) {
      startedRef.current = true;
      attemptsRef.current = 0;
    }
  }, [status.playing, status.error]);

  // Failed? Switch to the built-in stream URL first, then retry with growing delays.
  useEffect(() => {
    if (!wantPlaying || !status.error) return;
    if (!fallbackRef.current && streamUrlRef.current && streamUrlRef.current !== FALLBACK_STREAM_URL) {
      fallbackRef.current = true;
      setUsingFallback(true);
      begin();
      return;
    }
    const delay = RETRY_DELAYS_MS[Math.min(attemptsRef.current, RETRY_DELAYS_MS.length - 1)];
    attemptsRef.current += 1;
    const t = setTimeout(() => {
      begin();
      setRetryTick((n) => n + 1); // re-run this effect even if the error text is unchanged
    }, delay);
    return () => clearTimeout(t);
  }, [wantPlaying, status.error, retryTick, begin]);

  // Paused or resumed from the lock screen / Control Center / headphones.
  useEffect(() => {
    if (
      wantRef.current &&
      startedRef.current &&
      !status.playing &&
      !status.isBuffering &&
      !status.error &&
      status.timeControlStatus === 'paused'
    ) {
      setWant(false); // paused from outside the app
    } else if (!wantRef.current && status.playing && Date.now() > ignorePlayingUntil.current) {
      // Resumed from outside the app. Its buffer is old, so reconnect at the live edge.
      setWant(true);
      attemptsRef.current = 0;
      begin();
    }
  }, [status.playing, status.isBuffering, status.error, status.timeControlStatus, begin]);

  // Keep the lock screen in step with the current track.
  const { title, artist, albumTitle } = metadata;
  useEffect(() => {
    if (lockActiveRef.current) player.updateLockScreenMetadata({ title, artist, albumTitle });
  }, [player, title, artist, albumTitle]);

  let state: LiveState = 'idle';
  if (wantPlaying) {
    if (status.error) state = 'reconnecting';
    else if (status.playing && !status.isBuffering) state = 'playing';
    else state = 'connecting';
  }

  return { state, toggle, usingFallback };
}
