// Rules for noticing that live playback has silently stalled (for example the network dropped
// mid-stream). The player normally reports failures as an error event and retries; a stall raises
// no event at all, so without a timer it would sit on "Connecting…" forever. Pure, so it is unit-tested;
// use-live-player.ts runs the timer.

/**
 * How long "playback wanted but nothing audible" may last before we reconnect. The first limit has to
 * outlast a normal start (about 7 s on this stream); later limits grow so a slow network is not hammered.
 */
export const STALL_LIMITS_MS = [15_000, 20_000, 30_000] as const;

/** The limit for the given number of consecutive reconnects already tried. */
export function stallLimitMs(attempts: number): number {
  const i = Math.min(Math.max(attempts, 0), STALL_LIMITS_MS.length - 1);
  return STALL_LIMITS_MS[i];
}

/** True when nothing audible has happened since `since` for longer than the limit allows. */
export function isStalled(now: number, since: number, attempts: number): boolean {
  return now - since > stallLimitMs(attempts);
}

type Snapshot = { playing: boolean; isBuffering: boolean; error: string | null; currentTime: number };

/**
 * Did audio actually move since `lastTime`? Audible means playing, not buffering, no error, and the
 * playback position advanced (a live stream's position keeps counting up while it is flowing).
 */
export function madeProgress(lastTime: number, s: Snapshot): boolean {
  return s.playing && !s.isBuffering && !s.error && s.currentTime !== lastTime;
}

/**
 * Has the connection to the live stream been lost? Besides an error, Android's player reports a server that
 * closes the connection (an encoder restart, a dropped link) as playback having *ended*: no error, not
 * buffering, just paused. A live stream never finishes, so that is a drop to reconnect from, and must not be
 * mistaken for the listener pausing from outside the app.
 */
export function isDropped(s: { error: string | null; playbackState: string }): boolean {
  return !!s.error || s.playbackState === 'ended';
}
