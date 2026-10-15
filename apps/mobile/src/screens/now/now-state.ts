import type { Health, NowPlaying } from '@/api/types';

// Pure functions: what the Now screen should say for a given API answer. `null` from the API means
// "unknown" and gets an explicit empty-state sentence, never "TBD" (docs/mobile-app/plan.md).

export const STATION_NAME = 'WJRH 104.9 FM';

export type ShowHeading = { badge: 'LIVE' | 'AUTOMATED' | null; title: string; subtitle: string | null };

export function showHeading(np: NowPlaying | undefined): ShowHeading {
  const show = np?.show;
  const hosts = show?.hostNames.length ? `with ${show.hostNames.join(', ')}` : null;
  if (!np) return { badge: null, title: STATION_NAME, subtitle: 'Lafayette College radio' };
  if (np.live) return { badge: 'LIVE', title: show?.name ?? STATION_NAME, subtitle: hosts };
  if (np.automation) {
    return { badge: 'AUTOMATED', title: show?.name ?? STATION_NAME, subtitle: hosts ?? 'Automated programming' };
  }
  return { badge: null, title: show?.name ?? STATION_NAME, subtitle: hosts };
}

export type TrackLines = { title: string; artist: string; album: string | null; known: boolean };

/** The track block: title, artist and album while a track plays. Album is omitted until known. */
export function trackLines(track: NowPlaying['track'] | undefined): TrackLines {
  if (!track) {
    return { title: 'Waiting for track information', artist: '', album: null, known: false };
  }
  return {
    title: track.title ?? 'Track title unavailable',
    artist: track.artist ?? 'Artist metadata unavailable',
    album: track.album,
    known: track.title !== null || track.artist !== null,
  };
}

/**
 * The now-playing answer to show as current. One saved by an earlier run of the app is only a "last
 * known" fallback: while a fresh answer is still on its way it would show an old track as playing now.
 */
export function usableNowPlaying(opts: {
  data: NowPlaying | undefined;
  fromEarlierRun: boolean;
  fetching: boolean; // a request is in flight
  offline: boolean; // the phone reports no connection, so no fresh answer is coming
}): NowPlaying | undefined {
  if (opts.data && opts.fromEarlierRun && opts.fetching && !opts.offline) return undefined;
  return opts.data;
}

/** A line to show above the content when something is off, or null when all is well. */
export function statusNotice(opts: {
  health: Health | undefined;
  offline: boolean; // the phone reports no connection
  nowPlayingFailedWithNoData: boolean;
  showingStaleSince: string | null; // formatted time of the last good answer, when a refresh failed
  lastKnownAt: string | null; // formatted time of the last good answer we still have, if any
  metadataStale: boolean; // the server says the track info may be out of date
}): string | null {
  if (opts.offline) {
    // Live audio needs a connection too, so don't say it still works.
    return opts.lastKnownAt
      ? `You're offline. Showing last known info from ${opts.lastKnownAt}.`
      : "You're offline. Connect to the internet to listen and see what's playing.";
  }
  const stream = opts.health?.services.stream.status;
  if (stream === 'down') return 'The stream is reporting a problem. We keep trying to connect.';
  if (opts.nowPlayingFailedWithNoData) {
    return "Can't reach WJRH's info service. Live audio still works.";
  }
  if (opts.showingStaleSince) return `Showing last known info from ${opts.showingStaleSince}.`;
  if (opts.metadataStale) return 'Track info may be out of date.';
  return null;
}
