// Station-owned editorial content, reviewed in git (backend/content/*.json) and
// bundled at build time. The calendar owns *when*; this owns *what* and *who*.

import showsDoc from '../../content/shows.json';
import stationDoc from '../../content/station.json';

export interface Artwork {
  url: string;
  width: number;
  height: number;
  alt: string;
}

export interface ShowProfile {
  id: string;
  name: string;
  aliases: string[];
  genres: string[];
  description: string | null;
  hostNames: string[];
  hostBio: string | null;
  artwork: Artwork | null;
  active: boolean;
}

export const showsUpdatedAt: string = showsDoc.updatedAt;
export const shows: ShowProfile[] = showsDoc.shows as ShowProfile[];
export const station = stationDoc;

/**
 * The station record as the public API sends it. The roster is students' names and emails, so it goes out only once
 * the station has approved it (`approved`); until then the team list is empty. The app also hides it, but anyone can
 * call the API directly.
 */
export function publicStation<T extends { approved: boolean; team: unknown[] }>(record: T): T {
  return record.approved ? record : { ...record, team: [] };
}

/** Same slug rule as fetch_schedule.py so IDs match the existing schedule.json. */
export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'show';
}

const index = new Map<string, ShowProfile>();
for (const show of shows) {
  index.set(show.id, show);
  for (const alias of show.aliases) index.set(slugify(alias), show);
}

export function profileFor(id: string): ShowProfile | null {
  return index.get(id) ?? null;
}

/** Map a calendar show name to a stable show ID. Unknown names keep their slug but have no profile. */
export function resolveShow(name: string): { id: string; profile: ShowProfile | null } {
  const slug = slugify(name);
  const profile = index.get(slug) ?? null;
  return { id: profile?.id ?? slug, profile };
}

export function hostNamesFromDj(dj: string): string[] {
  return dj
    .split(/\s+(?:and|&|\+|with)\s+/i)
    .map((p) => p.trim())
    .filter(Boolean);
}
