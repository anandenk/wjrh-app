import { readFile } from 'node:fs/promises';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

export default defineConfig(async () => {
  const migrations = await readD1Migrations('./migrations');
  // Fixtures are read in Node and handed to the Workers runtime as bindings.
  const fixtureIcs = await readFile('../mocks/fixtures/calendar-snapshot.ics', 'utf8');
  const legacySchedule = await readFile('../../wjrh-app/schedule.json', 'utf8');
  return {
    plugins: [
      cloudflareTest({
        main: './src/index.ts',
        wrangler: { configPath: './wrangler.toml', environment: 'dev' },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            FIXTURE_ICS: fixtureIcs,
            LEGACY_SCHEDULE: legacySchedule,
            ADMIN_TOKEN: 'test-token',
            S3_ACCESS_KEY_ID: 'test-key',
            S3_SECRET_ACCESS_KEY: 'test-secret',
            JOIN_SALT: 'test-salt',
            NOW_PLAYING_CACHE_SECONDS: '0',
            CORS_ORIGINS: 'https://www.wjrh.org,http://127.0.0.1:8765',
          },
        },
      }),
    ],
    test: { setupFiles: ['./test/setup.ts'] },
  };
});
