// Captured from the local fake station (backend/scripts/dev.sh). Used when
// EXPO_PUBLIC_USE_FIXTURES=1 so screens can be built without a running API.
// `npm run check:contract` verifies these still match backend/schemas.
import archives from './archives.json';
import health from './health.json';
import nowPlaying from './now-playing.json';
import recent from './recent.json';
import schedule from './schedule.json';
import scheduleWeekly from './schedule-weekly.json';
import showArchives from './show-archives.json';
import shows from './shows.json';
import station from './station.json';

// Keyed by path without the query string. Show archives are matched by prefix in the client.
export const fixtures: Record<string, unknown> = {
  '/health': health,
  '/now-playing': nowPlaying,
  '/recent': recent,
  '/schedule': schedule,
  '/schedule/weekly': scheduleWeekly,
  '/shows': shows,
  '/archives': archives,
  '/station': station,
};

export const showArchivesFixture: unknown = showArchives;
