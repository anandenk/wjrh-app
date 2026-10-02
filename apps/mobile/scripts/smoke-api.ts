// Runs the real API client against a running API and checks every response against the JSON
// schemas. Needs the local stack:  backend/scripts/dev.sh   then   npm run smoke:api
// (EXPO_PUBLIC_API_BASE defaults to http://127.0.0.1:8787; EXPO_PUBLIC_USE_FIXTURES=1 tests fixture mode.)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import Ajv from 'ajv';

process.env.EXPO_PUBLIC_API_BASE ??= 'http://127.0.0.1:8787';

const schema = (name: string) =>
  JSON.parse(readFileSync(join(__dirname, `../../../backend/schemas/${name}.schema.json`), 'utf8'));

async function main() {
  // Imported after the env var is set, because src/config.ts reads it at load time.
  const { ApiError, NetworkError, apiGet } = await import('../src/api/client');
  const ep = await import('../src/api/endpoints');

  const ajv = new Ajv({ strict: false, allErrors: true });
  let failures = 0;
  const check = (name: string, ok: boolean, detail = '') => {
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
    if (!ok) failures++;
  };
  const conforms = (name: string, schemaName: string, data: unknown) => {
    const validate = ajv.compile(schema(schemaName));
    check(name, validate(data) as boolean, validate.errors ? ajv.errorsText(validate.errors) : '');
  };

  const shows = await ep.getShows();
  conforms('GET /health', 'health', await ep.getHealth());
  conforms('GET /now-playing', 'now-playing', await ep.getNowPlaying());
  conforms('GET /recent', 'recent', await ep.getRecent(20));
  conforms('GET /station', 'station', await ep.getStation());
  conforms('GET /shows', 'shows', shows);
  conforms('GET /schedule/weekly', 'schedule-weekly', await ep.getWeeklySchedule());
  conforms('GET /schedule', 'schedule', await ep.getSchedule('2026-10-02', '2026-10-04'));
  conforms('GET /archives', 'archives-index', await ep.getArchives());
  conforms('GET /shows/:id/archives', 'show-archives', await ep.getShowArchives(shows.shows[0].id));

  if (process.env.EXPO_PUBLIC_USE_FIXTURES !== '1') {
    // Error envelope -> ApiError with code and requestId.
    try {
      await ep.getShowArchives('no-such-show');
      check('unknown show -> ApiError', false, 'did not throw');
    } catch (e) {
      check(
        'unknown show -> ApiError',
        e instanceof ApiError && e.status === 404 && !!e.code,
        e instanceof ApiError ? `${e.status} ${e.code} requestId=${e.requestId}` : String(e),
      );
    }
  }

  // The listener app must never reach admin endpoints.
  await apiGet('/admin/archives').then(
    () => check('admin path blocked', false, 'did not throw'),
    (e) => check('admin path blocked', !(e instanceof ApiError) && !(e instanceof NetworkError)),
  );

  console.log(failures ? `\n${failures} failure(s)` : '\nall good');
  process.exit(failures ? 1 : 0);
}

main();
