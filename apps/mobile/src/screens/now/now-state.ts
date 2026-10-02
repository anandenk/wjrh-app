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

/** A line to show above the content when something is off, or null when all is well. */
export function statusNotice(opts: {
  health: Health | undefined;
  nowPlayingFailedWithNoData: boolean;
  showingStaleSince: string | null; // formatted time of the last good answer, when a refresh failed
  metadataStale: boolean; // the server says the track info may be out of date
}): string | null {
  const stream = opts.health?.services.stream.status;
  if (stream === 'down') return 'The stream is reporting a problem. We keep trying to connect.';
  if (opts.nowPlayingFailedWithNoData) {
    return "Can't reach WJRH's info service. Live audio still works.";
  }
  if (opts.showingStaleSince) return `Showing last known info from ${opts.showingStaleSince}.`;
  if (opts.metadataStale) return 'Track info may be out of date.';
  return null;
}
