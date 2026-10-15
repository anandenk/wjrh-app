// DEMO ONLY. The rules of the pretend archive player: it has a clock and a position but plays no audio. Real
// archives will play inside Mixcloud's own player (plan.md, decision 002), never through this.
import type { DemoEpisode } from './demo-data';

export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused';

export type DemoPlayerState = {
  episode: DemoEpisode | null;
  status: PlayerStatus;
  /** Seconds into the episode. */
  position: number;
};

export type DemoPlayerAction =
  | { type: 'select'; episode: DemoEpisode } // start this episode from the beginning (loads first)
  | { type: 'loaded' }
  | { type: 'toggle' }
  | { type: 'tick' } // one second of playing
  | { type: 'seekBy'; seconds: number }
  | { type: 'seekTo'; seconds: number }
  | { type: 'stop' };

export const initialPlayerState: DemoPlayerState = { episode: null, status: 'idle', position: 0 };

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function moveTo(state: DemoPlayerState, seconds: number): DemoPlayerState {
  if (!state.episode || (state.status !== 'playing' && state.status !== 'paused')) return state;
  const end = state.episode.durationSeconds;
  const position = clamp(seconds, 0, end);
  // Reaching the end stops the clock, as a finished recording would.
  return { ...state, position, status: position >= end ? 'paused' : state.status };
}

export function playerReducer(state: DemoPlayerState, action: DemoPlayerAction): DemoPlayerState {
  switch (action.type) {
    case 'select':
      return { episode: action.episode, status: 'loading', position: 0 };
    case 'loaded':
      return state.status === 'loading' ? { ...state, status: 'playing' } : state;
    case 'toggle': {
      if (!state.episode) return state;
      if (state.status === 'playing') return { ...state, status: 'paused' };
      if (state.status === 'paused') {
        // Pressing play on a finished episode starts it over.
        const finished = state.position >= state.episode.durationSeconds;
        return { ...state, status: 'playing', position: finished ? 0 : state.position };
      }
      return state;
    }
    case 'tick':
      return state.status === 'playing' ? moveTo(state, state.position + 1) : state;
    case 'seekBy':
      return moveTo(state, state.position + action.seconds);
    case 'seekTo':
      return moveTo(state, action.seconds);
    case 'stop':
      return initialPlayerState;
  }
}
